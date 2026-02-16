/**
 * Sync Service for syncing local trips with backend
 */

import NetInfo from '@react-native-community/netinfo';
import { database } from '../database';
import { tripAPI, transformTripForApi, type DBTrip, type ApiTrip } from '../api/trips';
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

      // Validate minimum distances before syncing
      const MIN_WALK_DISTANCE = 400;
      const MIN_RIDE_DISTANCE = 1000;
      if (trip.type === 'walk' && trip.distance < MIN_WALK_DISTANCE) {
        console.log(`[SyncService] Walk trip ${tripId} too short (${trip.distance}m), skipping sync`);
        return false;
      }
      if (trip.type === 'cycle' && trip.distance < MIN_RIDE_DISTANCE) {
        console.log(`[SyncService] Cycle trip ${tripId} too short (${trip.distance}m), skipping sync`);
        return false;
      }
      if (trip.type === 'drive' || trip.type === 'run') {
        console.log(`[SyncService] Trip ${tripId} type '${trip.type}' not supported, skipping sync`);
        return false;
      }

      // GPS drift validation — check if trip stayed in a tiny area
      const locations = await database.getLocationsByTrip(tripId);
      if (locations.length >= 2) {
        const coords = locations.map(loc => ({
          latitude: loc.latitude,
          longitude: loc.longitude,
        }));
        const validation = TripValidationService.validateTrip(coords, trip.distance);
        if (!validation.isValid) {
          console.log(`[SyncService] Trip ${tripId} failed GPS drift check: ${validation.reasons.join('; ')}, skipping sync`);
          return false;
        }
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

        // Check 1: Distance thresholds
        if (trip.type === 'walk' && trip.distance < MIN_WALK_DISTANCE) {
          cancelReason = `Walk too short (${trip.distance.toFixed(0)}m < ${MIN_WALK_DISTANCE}m)`;
        } else if (trip.type === 'cycle' && trip.distance < MIN_RIDE_DISTANCE) {
          cancelReason = `Cycle too short (${trip.distance.toFixed(0)}m < ${MIN_RIDE_DISTANCE}m)`;
        } else if (trip.type === 'drive' || trip.type === 'run') {
          cancelReason = `Unsupported type: ${trip.type}`;
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

export const syncService = new SyncService();
