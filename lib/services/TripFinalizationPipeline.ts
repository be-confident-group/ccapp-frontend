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

    // Calculate distance and duration from stored GPS location points
    try {
      const locations = await database.getLocationsByTrip(tripId);
      if (locations.length >= 2) {
        let distanceMeters = 0;
        for (let i = 1; i < locations.length; i++) {
          const from: Coordinate = { latitude: locations[i - 1].latitude, longitude: locations[i - 1].longitude };
          const to: Coordinate   = { latitude: locations[i].latitude,     longitude: locations[i].longitude };
          distanceMeters += calculateDistance(from, to);
        }
        const durationSec = Math.round(
          (locations[locations.length - 1].timestamp - locations[0].timestamp) / 1000
        );
        await database.updateTrip(tripId, {
          distance: Math.round(distanceMeters) / 1000,
          duration: durationSec,
        });
        console.log(`[TripFinalizationPipeline] stats: ${(distanceMeters / 1000).toFixed(3)} km, ${durationSec}s`);
      }
    } catch (err) {
      console.warn(`[TripFinalizationPipeline] stats calculation failed: ${String(err)}`);
    }

    // Classify trip type and method from CMMA motion segments
    try {
      const { MotionActivitySegmenter } = await import('./MotionActivitySegmenter');
      const seg = await MotionActivitySegmenter.analyze(tripId);
      const method = ['ml', 'cmma'].includes(seg.classificationMethod) ? 'ml' : 'speed';
      await database.updateTrip(tripId, {
        classification_method: method,
        type: seg.dominantType as any,
        ...(seg.confidence > 0 ? { ml_activity_type: seg.dominantType, ml_confidence: seg.confidence / 100 } : {}),
      });
      console.log(`[TripFinalizationPipeline] classified as ${seg.dominantType} (${method}), ${seg.segments.length} segments`);
    } catch (err) {
      console.warn(`[TripFinalizationPipeline] segmentation failed: ${String(err)}`);
    }

    // Run shadow classifier (best-effort)
    try {
      const { ShadowClassifierLogger } = await import('./ShadowClassifierLogger');
      await ShadowClassifierLogger.run(tripId);
    } catch (err) {
      console.warn(`[TripFinalizationPipeline] shadow classifier failed: ${String(err)}`);
    }

    // Sync (best-effort)
    try {
      const { syncService } = await import('./SyncService');
      await syncService.syncSingleTrip(tripId);
    } catch (err) {
      console.error(`[TripFinalizationPipeline] sync failed: ${String(err)}`);
    }

    // Signal native state machine to return to idle
    try {
      const { RadziTrackerNative } = await import('../native/RadziTracker');
      await RadziTrackerNative.notifyFinalizationComplete();
    } catch (err) {
      console.warn(`[TripFinalizationPipeline] notifyFinalizationComplete failed: ${String(err)}`);
    }

    console.log('[TripFinalizationPipeline] complete for', tripId);
  }
}
