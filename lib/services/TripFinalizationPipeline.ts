import { database } from '../database';
import { calculateDistance, type Coordinate } from '../utils/geoCalculations';

export class TripFinalizationPipeline {
  static async finalize(tripId: string): Promise<void> {
    console.log('[TripFinalizationPipeline] starting for', tripId);

    // Verify trip exists
    const trip = await database.getTripById(tripId);
    if (!trip) {
      console.warn(`[TripFinalizationPipeline] trip ${tripId} not found`);
      return;
    }

    // Small delay so the WAL checkpoint from the native endTrip() write has time
    // to propagate to expo-sqlite's reader before we query.
    await new Promise(resolve => setTimeout(resolve, 300));

    const freshTrip = await database.getTripById(tripId) || trip;
    let fallbackDistance = freshTrip.distance ?? 0;

    if (fallbackDistance <= 0) {
      // Fallback: try to compute from locations (legacy engine or missing native stats)
      try {
        const locations = await database.getLocationsByTrip(tripId);
        if (locations.length >= 2) {
          let distanceMeters = 0;
          for (let i = 1; i < locations.length; i++) {
            const from: Coordinate = { latitude: locations[i - 1].latitude, longitude: locations[i - 1].longitude };
            const to: Coordinate   = { latitude: locations[i].latitude,     longitude: locations[i].longitude };
            distanceMeters += calculateDistance(from, to);
          }
          const durationSec = Math.round((locations[locations.length - 1].timestamp - locations[0].timestamp) / 1000);
          fallbackDistance = Math.round(distanceMeters);
          await database.updateTrip(tripId, { distance: fallbackDistance, duration: durationSec });
          console.log(`[TripFinalizationPipeline] fallback stats: ${fallbackDistance}m, ${durationSec}s`);
        }
      } catch (err) {
        console.warn(`[TripFinalizationPipeline] stats fallback failed: ${String(err)}`);
      }
    } else {
      console.log(`[TripFinalizationPipeline] using native stats: ${freshTrip.distance}m, ${freshTrip.duration}s`);
    }

    const { TripValidationService } = await import('./TripValidationService');
    const { syncService } = await import('./SyncService');
    const { RadziTrackerNative } = await import('../native/RadziTracker');

    // Classify trip and check for multi-modal segments
    try {
      const { MotionActivitySegmenter } = await import('./MotionActivitySegmenter');
      const seg = await MotionActivitySegmenter.analyze(tripId);
      
      if (seg.isMultiModal && seg.segments.length > 1) {
        console.log(`[TripFinalizationPipeline] Multi-modal trip detected! Splitting into ${seg.segments.length} segments.`);
        
        const MIN_SEGMENT_DIST: Record<string, number> = {
           walk: 400, cycle: 1000, run: 500, drive: 2000
        };
        
        for (let i = 0; i < seg.segments.length; i++) {
          const segment = seg.segments[i];
          const subTripId = `${tripId}_segment${i}`;
          const minDist = MIN_SEGMENT_DIST[segment.type] ?? 400;
          
          if (segment.distance < minDist) {
            console.log(`[TripFinalizationPipeline] Skipping segment ${i} (${segment.type}): ${segment.distance.toFixed(0)}m < ${minDist}m`);
            continue;
          }
          
          const segmentRouteForSync = segment.locations.map(loc => ({
            lat: Number(loc.latitude.toFixed(6)),
            lng: Number(loc.longitude.toFixed(6)),
            timestamp: new Date(loc.timestamp).toISOString(),
          }));
          
          const segmentStartTime = segment.locations[0].timestamp;
          const segmentEndTime = segment.locations[segment.locations.length - 1].timestamp;
          const method = ['ml', 'cmma'].includes(seg.classificationMethod) ? 'ml' : 'speed';
          
          await database.createTrip({
            id: subTripId,
            user_id: freshTrip.user_id || 'current_user',
            type: segment.type,
            status: 'completed',
            is_manual: 0,
            start_time: segmentStartTime,
            end_time: segmentEndTime,
            distance: segment.distance,
            duration: segment.duration,
            avg_speed: segment.avgSpeed,
            max_speed: segment.maxSpeed,
            elevation_gain: 0,
            calories: 0,
            co2_saved: 0,
            notes: `Segment ${i + 1} of ${seg.segments.length} (multi-modal trip)`,
            route_data: JSON.stringify(segmentRouteForSync),
            created_at: Date.now(),
            updated_at: Date.now(),
            synced: 0,
          });
          // Set ML classification fields (not in createTrip's INSERT)
          await database.updateTrip(subTripId, {
            classification_method: method,
            ml_activity_type: method === 'ml' ? segment.type : null,
            ml_confidence: method === 'ml' ? segment.confidence / 100 : null,
          });
          
          console.log(`[TripFinalizationPipeline] Validating sub-trip ${subTripId}...`);
          const val = await TripValidationService.validateAndFinalizeTrip(subTripId, segmentEndTime);
          if (val.isValid) {
            await syncService.syncSingleTrip(subTripId);
          }
        }
        
        // Cancel the original parent trip
        await database.updateTrip(tripId, {
          status: 'cancelled',
          notes: `Multi-modal trip split into segments`
        });
        
      } else {
        // Single-mode trip
        const method = ['ml', 'cmma'].includes(seg.classificationMethod) ? 'ml' : 'speed';
        await database.updateTrip(tripId, {
          classification_method: method,
          type: seg.dominantType as any,
          ...(seg.confidence > 0 ? { ml_activity_type: seg.dominantType, ml_confidence: seg.confidence / 100 } : {}),
        });
        console.log(`[TripFinalizationPipeline] classified as ${seg.dominantType} (${method})`);
        
        console.log(`[TripFinalizationPipeline] Validating single-mode trip ${tripId}...`);
        const val = await TripValidationService.validateAndFinalizeTrip(tripId, freshTrip.end_time || Date.now());
        if (val.isValid) {
          await syncService.syncSingleTrip(tripId);
        }
      }
    } catch (err) {
      console.warn(`[TripFinalizationPipeline] segmentation/validation failed: ${String(err)}`);
    }

    // Run shadow classifier (best-effort)
    try {
      const { ShadowClassifierLogger } = await import('./ShadowClassifierLogger');
      await ShadowClassifierLogger.run(tripId);
    } catch (err) {
      console.warn(`[TripFinalizationPipeline] shadow classifier failed: ${String(err)}`);
    }

    // Signal native state machine to return to idle
    try {
      await RadziTrackerNative.notifyFinalizationComplete();
    } catch (err) {
      console.warn(`[TripFinalizationPipeline] notifyFinalizationComplete failed: ${String(err)}`);
    }

    console.log('[TripFinalizationPipeline] complete for', tripId);
  }
}
