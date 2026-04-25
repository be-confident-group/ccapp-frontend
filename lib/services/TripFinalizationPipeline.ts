import { database } from '../database';

export class TripFinalizationPipeline {
  static async finalize(tripId: string): Promise<void> {
    console.log('[TripFinalizationPipeline] starting for', tripId);

    // Verify trip exists
    const trip = await database.getTripById(tripId);
    if (!trip) {
      console.warn(`[TripFinalizationPipeline] trip ${tripId} not found`);
      return;
    }

    // Run shadow classifier (best-effort, import lazily to avoid circular deps)
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

    console.log('[TripFinalizationPipeline] complete for', tripId);
  }
}
