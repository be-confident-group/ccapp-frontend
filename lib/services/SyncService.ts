/**
 * Sync Service for syncing local trips with backend
 */

import NetInfo from '@react-native-community/netinfo';
import { database } from '../database';
import { tripAPI, transformTripForApi, type DBTrip, type ApiTrip, type ApiTripCreate } from '../api/trips';
import type { Trip } from '../database/db';
import { TripValidationService } from './TripValidationService';

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  totalAttempted: number;
  errors: Array<{
    tripId: string;
    error: string;
  }>;
}

export interface SyncStatus {
  isSyncing: boolean;
  lastSyncTime: number | null;
  unsyncedCount: number;
}

/**
 * Sync Service for managing trip synchronization
 */
class SyncService {
  private isSyncing = false;
  private lastSyncTime: number | null = null;
  private retryDelays = [1000, 2000, 4000, 8000]; // Exponential backoff

  /**
   * Check if device has network connectivity
   */
  async checkNetwork(): Promise<boolean> {
    try {
      const netInfo = await NetInfo.fetch();
      return netInfo.isConnected === true && netInfo.isInternetReachable !== false;
    } catch (error) {
      console.error('[SyncService] Error checking network:', error);
      return false;
    }
  }

  /**
   * Get count of unsynced trips
   */
  async getUnsyncedCount(): Promise<number> {
    try {
      const unsyncedTrips = await database.getAllTrips({ synced: false, status: 'completed' });
      return unsyncedTrips.length;
    } catch (error) {
      console.error('[SyncService] Error getting unsynced count:', error);
      return 0;
    }
  }

  /**
   * Get current sync status
   */
  async getSyncStatus(): Promise<SyncStatus> {
    const unsyncedCount = await this.getUnsyncedCount();
    return {
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      unsyncedCount,
    };
  }

  /**
   * Sync a single trip by ID
   */
  async syncSingleTrip(tripId: string, retryCount = 0): Promise<boolean> {
    try {
      console.log(`[SyncService] Syncing trip ${tripId}...`);

      // Check network first
      const isOnline = await this.checkNetwork();
      if (!isOnline) {
        console.log('[SyncService] No network connection, skipping sync');
        return false;
      }

      // Get trip from database
      const trip = await database.getTrip(tripId);
      if (!trip) {
        console.error(`[SyncService] Trip ${tripId} not found in database`);
        return false;
      }

      // Skip if already synced
      if (trip.synced === 1) {
        console.log(`[SyncService] Trip ${tripId} already synced`);
        return true;
      }

      // Skip trips that shouldn't be synced
      if (trip.status !== 'completed') {
        console.log(`[SyncService] Trip ${tripId} not completed (${trip.status}), skipping sync`);
        return false;
      }

      // Transform to API format
      const apiTrip = transformTripForApi(trip as DBTrip);

      // Send to backend
      const backendTrip = await tripAPI.createTrip(apiTrip);

      // Mark as synced in database and store backend_id
      await database.updateTrip(tripId, {
        synced: 1,
        backend_id: backendTrip.id,
        updated_at: Date.now()
      });

      console.log(`[SyncService] Successfully synced trip ${tripId}`);
      return true;
    } catch (error) {
      console.error(`[SyncService] Error syncing trip ${tripId}:`, error);
      console.error(`[SyncService] Error details:`, {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        tripId: tripId
      });

      // Handle specific error cases
      if (error instanceof Error) {
        // Auth error - don't retry
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          console.error('[SyncService] Auth error - user needs to log in again');
          return false;
        }

        // Duplicate trip error - mark as synced anyway
        if (error.message.includes('client_id') || error.message.includes('duplicate') || error.message.includes('unique')) {
          console.log(`[SyncService] Trip ${tripId} already exists on server, marking as synced`);
          await database.updateTrip(tripId, {
            synced: 1,
            updated_at: Date.now()
          });
          return true;
        }

        // Network error - retry with backoff
        if (error.message.includes('Network')) {
          if (retryCount < this.retryDelays.length) {
            const delay = this.retryDelays[retryCount];
            console.log(`[SyncService] Network error, retrying in ${delay}ms (attempt ${retryCount + 1})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return await this.syncSingleTrip(tripId, retryCount + 1);
          }
        }
      }

      return false;
    }
  }

  /**
   * Sync all unsynced trips
   * Batches trips in groups of 50 for efficiency
   */
  async syncTrips(): Promise<SyncResult> {
    // Prevent concurrent syncs
    if (this.isSyncing) {
      console.log('[SyncService] Sync already in progress');
      return {
        success: false,
        syncedCount: 0,
        failedCount: 0,
        totalAttempted: 0,
        errors: [{ tripId: 'all', error: 'Sync already in progress' }],
      };
    }

    this.isSyncing = true;

    try {
      console.log('[SyncService] Starting trip sync...');

      // Check network
      const isOnline = await this.checkNetwork();
      if (!isOnline) {
        console.log('[SyncService] No network connection');
        return {
          success: false,
          syncedCount: 0,
          failedCount: 0,
          totalAttempted: 0,
          errors: [{ tripId: 'all', error: 'No network connection' }],
        };
      }

      // Get unsynced trips
      const unsyncedTrips = await database.getAllTrips({
        synced: false,
        status: 'completed' // Only sync completed trips
      });

      if (unsyncedTrips.length === 0) {
        console.log('[SyncService] No trips to sync');
        return {
          success: true,
          syncedCount: 0,
          failedCount: 0,
          totalAttempted: 0,
          errors: [],
        };
      }

      console.log(`[SyncService] Found ${unsyncedTrips.length} trips to sync`);

      const result: SyncResult = {
        success: true,
        syncedCount: 0,
        failedCount: 0,
        totalAttempted: unsyncedTrips.length,
        errors: [],
      };

      // Process trips in batches of 50
      const batchSize = 50;
      for (let i = 0; i < unsyncedTrips.length; i += batchSize) {
        const batch = unsyncedTrips.slice(i, i + batchSize);

        // Transform batch to API format with individual error handling
        const apiTrips: any[] = [];
        const transformErrors: Array<{ tripId: string; error: string }> = [];

        for (const trip of batch) {
          try {
            const apiTrip = transformTripForApi(trip as DBTrip);
            apiTrips.push(apiTrip);
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[SyncService] Failed to transform trip ${trip.id}:`, errorMsg);
            transformErrors.push({
              tripId: trip.id,
              error: errorMsg,
            });
            result.failedCount++;
            result.errors.push({
              tripId: trip.id,
              error: `Transform error: ${errorMsg}`,
            });
          }
        }

        if (apiTrips.length === 0) {
          console.log(`[SyncService] Batch ${i / batchSize + 1}: All trips failed transformation`);
          continue;
        }

        console.log(`[SyncService] Batch ${i / batchSize + 1}: Transformed ${apiTrips.length}/${batch.length} trips successfully`);

        try {
          // Sync batch
          const syncResult = await tripAPI.syncTrips(apiTrips);

          // Mark synced trips in database and store backend_id
          if (syncResult.success && syncResult.synced.length > 0) {
            for (const syncedTrip of syncResult.synced) {
              await database.updateTrip(syncedTrip.client_id, {
                synced: 1,
                backend_id: syncedTrip.id,
                updated_at: Date.now(),
              });
              result.syncedCount++;
            }
          }

          // Track failed trips
          if (syncResult.failed.length > 0) {
            result.failedCount += syncResult.failed.length;
            result.errors.push(...syncResult.failed.map(f => ({
              tripId: f.client_id,
              error: f.error,
            })));
          }
        } catch (error) {
          console.error(`[SyncService] Error syncing batch:`, error);

          // If batch sync fails, try individual syncs
          for (const trip of batch) {
            const success = await this.syncSingleTrip(trip.id);
            if (success) {
              result.syncedCount++;
            } else {
              result.failedCount++;
              result.errors.push({
                tripId: trip.id,
                error: error instanceof Error ? error.message : 'Unknown error',
              });
            }
          }
        }
      }

      // Update last sync time
      this.lastSyncTime = Date.now();

      console.log(`[SyncService] Sync complete: ${result.syncedCount} synced, ${result.failedCount} failed`);

      // Fire-and-forget: push any pending raw IMU batches to the backend now
      // that the parent trips have backend_ids.
      void this.syncSensorBatches();

      // Fire-and-forget: propagate dirty field edits (user_note, type) for
      // already-synced trips.
      void this.syncDirtyTrips();

      return result;
    } catch (error) {
      console.error('[SyncService] Sync error:', error);
      return {
        success: false,
        syncedCount: 0,
        failedCount: 0,
        totalAttempted: 0,
        errors: [{
          tripId: 'all',
          error: error instanceof Error ? error.message : 'Unknown error',
        }],
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Retry failed syncs with exponential backoff
   */
  private async retrySync(tripId: string, attempt: number): Promise<boolean> {
    if (attempt >= this.retryDelays.length) {
      console.log(`[SyncService] Max retry attempts reached for trip ${tripId}`);
      return false;
    }

    const delay = this.retryDelays[attempt];
    console.log(`[SyncService] Retrying trip ${tripId} in ${delay}ms (attempt ${attempt + 1})`);

    await new Promise(resolve => setTimeout(resolve, delay));

    return await this.syncSingleTrip(tripId, attempt);
  }

  /**
   * Handle sync errors
   */
  private async handleSyncError(error: Error, tripId: string): Promise<void> {
    console.error(`[SyncService] Error syncing trip ${tripId}:`, error.message);

    // Auth error - clear token and notify user
    if (error.message.includes('401')) {
      console.error('[SyncService] Authentication error - user needs to log in');
      // TODO: Emit event or trigger logout
    }

    // Validation error - mark trip as invalid
    if (error.message.includes('400')) {
      console.error('[SyncService] Validation error for trip:', error.message);
      // TODO: Mark trip as having validation error
    }
  }

  /**
   * Clean up existing invalid trips in local DB
   * Cancels completed but unsynced trips that are too short or unsupported type.
   * Call on app startup/foreground resume to clean up legacy drift trips.
   */
  async cleanupInvalidTrips(): Promise<number> {
    try {
      const completedTrips = await database.getAllTrips({ status: 'completed', synced: false });
      let cleaned = 0;

      const MIN_WALK_DISTANCE = 400;
      const MIN_RIDE_DISTANCE = 1000;

      for (const trip of completedTrips) {
        let cancelReason: string | null = null;

        // Check 1: Distance thresholds. We now sync all 4 ML types (walk, cycle,
        // run, drive); the backend is responsible for `is_valid` on run/drive.
        // Frontend still skips very short walk/cycle trips because the UI
        // shows these and they're usually drift.
        if (trip.type === 'walk' && trip.distance < MIN_WALK_DISTANCE) {
          cancelReason = `Walk too short (${trip.distance.toFixed(0)}m < ${MIN_WALK_DISTANCE}m)`;
        } else if (trip.type === 'cycle' && trip.distance < MIN_RIDE_DISTANCE) {
          cancelReason = `Cycle too short (${trip.distance.toFixed(0)}m < ${MIN_RIDE_DISTANCE}m)`;
        }

        // Check 2: GPS drift detection (spatial validation)
        if (!cancelReason) {
          const locations = await database.getLocationsByTrip(trip.id);
          if (locations.length >= 2) {
            const coords = locations.map(loc => ({
              latitude: loc.latitude,
              longitude: loc.longitude,
            }));
            const validation = TripValidationService.validateTrip(coords, trip.distance);
            if (!validation.isValid) {
              cancelReason = `GPS drift: ${validation.reasons.join('; ')}`;
            }
          }
        }

        if (cancelReason) {
          await database.updateTrip(trip.id, {
            status: 'cancelled',
            notes: cancelReason,
          });
          cleaned++;
          console.log(`[SyncService] Cleaned trip ${trip.id}: ${cancelReason}`);
        }
      }

      if (cleaned > 0) {
        console.log(`[SyncService] Cleaned up ${cleaned} invalid trips total`);
      }

      return cleaned;
    } catch (error) {
      console.error('[SyncService] Error cleaning up invalid trips:', error);
      return 0;
    }
  }

  /**
   * Upload any queued raw IMU sensor batches to the backend for trips that
   * have already been synced. Batches for unsynced trips are skipped and
   * will be retried on the next sync cycle.
   *
   * Runs best-effort: individual batch failures are logged but don't abort
   * the loop. Successfully uploaded batches are marked `synced = 1` and
   * then deleted locally to keep the SQLite db bounded.
   */
  async syncSensorBatches(maxBatches = 100): Promise<{
    uploaded: number;
    failed: number;
    skipped: number;
  }> {
    const result = { uploaded: 0, failed: 0, skipped: 0 };

    try {
      const isOnline = await this.checkNetwork();
      if (!isOnline) return result;

      const pending = await database.getUnsyncedSensorBatches(maxBatches);
      if (pending.length === 0) return result;

      // Cache tripId → backendId lookups so we don't hit SQLite per batch.
      const backendIdCache = new Map<string, number | null>();
      const deletedTripIds = new Set<string>();

      for (const batch of pending) {
        if (batch.id === undefined) continue;

        let backendId = backendIdCache.get(batch.trip_id);
        if (backendId === undefined) {
          const trip = await database.getTrip(batch.trip_id);
          backendId = trip?.backend_id ?? null;
          backendIdCache.set(batch.trip_id, backendId);
        }

        if (backendId == null) {
          result.skipped++;
          continue;
        }

        try {
          // payload_json is stored as { data: [{t, ax, ay, az, gx, gy, gz}, ...] }
          // matching the backend SensorDataBatch schema.
          const payload = safeJsonParse(batch.payload_json);
          await tripAPI.uploadSensorBatch(backendId, payload);
          await database.markSensorBatchSynced(batch.id);
          result.uploaded++;
          deletedTripIds.add(batch.trip_id);
        } catch (err) {
          console.warn(
            `[SyncService] Failed to upload sensor batch ${batch.id} (trip ${batch.trip_id}):`,
            err instanceof Error ? err.message : err,
          );
          result.failed++;
        }
      }

      // Best-effort prune: if every batch for a trip is synced, drop the
      // rows locally. (Leave them if any failed to avoid re-upload loss.)
      if (result.failed === 0) {
        for (const tripId of deletedTripIds) {
          try {
            await database.deleteSensorBatchesByTrip(tripId);
          } catch (err) {
            console.warn(
              `[SyncService] Failed to prune sensor batches for ${tripId}:`,
              err instanceof Error ? err.message : err,
            );
          }
        }
      }

      if (result.uploaded > 0 || result.failed > 0) {
        console.log(
          `[SyncService] Sensor batch sync: ${result.uploaded} uploaded, ${result.failed} failed, ${result.skipped} skipped`,
        );
      }

      return result;
    } catch (error) {
      console.error('[SyncService] syncSensorBatches crashed:', error);
      return result;
    }
  }

  /**
   * PATCH a single trip's dirty fields to the backend and clear the dirty flags.
   */
  async patchTripFields(tripId: string): Promise<void> {
    const trip = await database.getTrip(tripId);
    if (!trip || !trip.backend_id) return;

    // Allow null for user_note so clearing a note sends null to the backend.
    // The intersection type widens user_note to string | null | undefined.
    type DirtyPatch = Omit<Partial<ApiTripCreate>, 'user_note'> & { user_note?: string | null };
    const dirty: DirtyPatch = {};
    if (trip.user_note_dirty) dirty.user_note = trip.user_note;
    if (trip.type_dirty) dirty.type = trip.type;

    if (Object.keys(dirty).length === 0) return;

    try {
      await tripAPI.patchTrip(trip.backend_id, dirty as Partial<ApiTripCreate>);
      await database.updateTrip(tripId, {
        user_note_dirty: 0,
        type_dirty: 0,
      });
      console.log(`[SyncService] PATCHed trip ${tripId} successfully`);
    } catch (error) {
      console.warn(`[SyncService] patchTripFields failed for ${tripId}:`, error instanceof Error ? error.message : error);
      throw error;
    }
  }

  /**
   * Find all synced trips with dirty flags and PATCH them to the backend.
   * Best-effort: individual failures leave the dirty flag set for the next cycle.
   */
  async syncDirtyTrips(): Promise<void> {
    try {
      const isOnline = await this.checkNetwork();
      if (!isOnline) return;

      // Find all synced trips that still have dirty edit flags
      const dirtyTrips = await database.getAllTrips({ synced: true });
      const targets = dirtyTrips.filter(t => t.user_note_dirty || t.type_dirty);
      for (const trip of targets) {
        try {
          await this.patchTripFields(trip.id);
        } catch {
          // best-effort: leave dirty flag set, retry next cycle
        }
      }
    } catch (error) {
      console.warn('[SyncService] syncDirtyTrips error:', error instanceof Error ? error.message : error);
    }
  }

  /**
   * Get last sync time
   */
  getLastSyncTime(): number | null {
    return this.lastSyncTime;
  }

  /**
   * Check if sync is in progress
   */
  isCurrentlySyncing(): boolean {
    return this.isSyncing;
  }
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    // Server can still accept a string; preferable over losing the data.
    return raw;
  }
}

export const syncService = new SyncService();
