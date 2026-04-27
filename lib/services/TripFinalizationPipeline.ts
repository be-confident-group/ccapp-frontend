import { database } from '../database';
import { calculateDistance } from '../utils/geoCalculations';

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
          distanceMeters += calculateDistance(
            locations[i - 1].latitude, locations[i - 1].longitude,
            locations[i].latitude,     locations[i].longitude
          );
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

    // Update classification method from CMMA segmenter
    try {
      const { MotionActivitySegmenter } = await import('./MotionActivitySegmenter');
      const seg = await MotionActivitySegmenter.segmentTrip(tripId);
      await database.updateTrip(tripId, { classification_method: seg.classificationMethod });
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
