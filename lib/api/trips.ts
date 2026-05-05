/**
 * Trip API service for backend integration
 */

import { apiClient } from './client';
import type { TripType, TripStatus } from '@/types/trip';
import { RouteFilter } from '@/lib/services/RouteFilter';

/**
 * Per-club result returned by POST /api/trips/{id}/share/.
 */
export interface TripShareResult {
  club_id: number;
  status: 'shared' | 'already_shared' | 'error';
  post_id?: number;
  message?: string;
}

/**
 * Backend API trip interfaces
 * NOTE: Keep in sync with backend api/trips/serializers.py
 */
export interface ApiTripRoute {
  lat: number;
  lng: number;
  timestamp: string; // ISO 8601
}

export interface ApiTripCreate {
  client_id: string;
  start_timestamp: string; // ISO 8601
  end_timestamp: string; // ISO 8601
  route?: ApiTripRoute[];
  type: TripType;
  is_manual: boolean;
  status?: TripStatus;
  elevation_gain?: number;
  classification_source: 'apple_motion' | 'android_motion' | 'manual' | 'speed';
  user_note?: string;
  elevation_loss?: number;
}

export interface ApiTrip {
  id: number;
  user: number;
  client_id: string;
  start_timestamp: string;
  end_timestamp: string;
  route?: ApiTripRoute[];
  type: TripType;
  is_manual: boolean;
  average_speed: number; // Backend calculated (km/h)
  distance: number; // Backend calculated (km)
  status: TripStatus;
  is_valid: boolean;
  user_confirmed: boolean | null;
  elevation_gain?: number;
  notes?: string; // @deprecated — use user_note or validation_log
  created_at: string;
  updated_at: string;
  duration: number; // Backend calculated (seconds)
  co2_saved: number; // Backend calculated (kg)
  max_speed?: number;
  moving_avg_speed?: number;
  moving_duration?: number;
  user_note?: string;
  validation_log?: string;
  elevation_loss?: number;
  classification_source: 'apple_motion' | 'android_motion' | 'manual' | 'speed';
}

export interface TripFilters {
  type?: TripType;
  status?: TripStatus;
  start_date?: string; // YYYY-MM-DD
  end_date?: string; // YYYY-MM-DD
}

export interface SyncResult {
  success: boolean;
  synced: ApiTrip[];
  failed: Array<{
    client_id: string;
    error: string;
  }>;
}

/**
 * Frontend DB trip interface (from SQLite)
 */
export interface DBTrip {
  id: string;
  user_id: string;
  type: TripType;
  status: TripStatus;
  is_manual: number; // SQLite stores as 0/1
  start_time: number; // Unix timestamp (ms)
  end_time: number;
  distance: number; // meters
  duration: number; // seconds
  avg_speed: number; // km/h
  max_speed: number; // km/h
  elevation_gain: number; // meters
  calories: number;
  co2_saved: number; // kg
  notes: string | null;
  route_data: string | null; // JSON stringified array
  created_at: number;
  updated_at: number;
  synced: number; // 0 or 1
  backend_id: number | null;
  ml_activity_type?: TripType | null;
  ml_confidence?: number | null;
  classification_method?: 'ml' | 'speed' | null;
  engine?: string | null;
  backfill_start?: number | null;
  detection_state?: string | null;
  // v7 migration fields
  user_note?: string | null;
  validation_log?: string | null;
  user_note_dirty?: number | null; // 0 or 1
  type_dirty?: number | null; // 0 or 1
  classification_source?: 'apple_motion' | 'android_motion' | 'manual' | 'speed' | null;
  moving_duration_s?: number | null;
  moving_avg_speed_kmh?: number | null;
  max_speed_filtered_kmh?: number | null;
  elevation_loss_m?: number | null;
  backend_avg_speed_kmh?: number | null;
  visible?: number | null; // 0 or 1
}

/**
 * Transform frontend DB trip to backend API format
 */
export function transformTripForApi(dbTrip: DBTrip): ApiTripCreate {
  // Guard: native engine trips must have a classification_source
  if (!dbTrip.classification_source && dbTrip.engine === 'native') {
    throw new Error(`Trip ${dbTrip.id} has native engine but no classification_source`);
  }

  // Validate trip type
  const validTypes = ['walk', 'run', 'cycle', 'drive'];
  if (!dbTrip.type || !validTypes.includes(dbTrip.type)) {
    throw new Error(`Invalid trip type "${dbTrip.type}" for trip ${dbTrip.id}. Must be one of: ${validTypes.join(', ')}`);
  }

  // Parse route data from JSON string
  let route: ApiTripRoute[] | undefined = undefined;

  if (dbTrip.route_data) {
    try {
      const routeData = JSON.parse(dbTrip.route_data);
      if (Array.isArray(routeData) && routeData.length > 0) {
        // Filter and validate coordinates
        // Support both {lat, lng} and {latitude, longitude} formats
        const validCoords = routeData.filter((coord: any) => {
          const lat = coord.lat ?? coord.latitude;
          const lng = coord.lng ?? coord.longitude;
          return (
            lat != null &&
            lng != null &&
            !isNaN(lat) &&
            !isNaN(lng) &&
            lat >= -90 && lat <= 90 &&
            lng >= -180 && lng <= 180
          );
        });

        if (validCoords.length > 0) {
          // Apply RouteFilter to remove accuracy outliers, duplicates, and speed spikes
          const activity = (dbTrip.type === 'walk' || dbTrip.type === 'run' || dbTrip.type === 'cycle')
            ? dbTrip.type
            : 'cycle'; // safe default for drive or unknown
          const filteredCoords = RouteFilter.filter(
            validCoords.map((coord: any) => ({
              lat: coord.lat ?? coord.latitude,
              lng: coord.lng ?? coord.longitude,
              timestamp: (() => {
                try {
                  if (coord.timestamp) {
                    const date = new Date(coord.timestamp);
                    return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
                  }
                  return new Date().toISOString();
                } catch {
                  return new Date().toISOString();
                }
              })(),
              accuracy: coord.accuracy,
            })),
            activity
          );

          route = filteredCoords.map(coord => ({
            lat: coord.lat,
            lng: coord.lng,
            timestamp: coord.timestamp,
          }));
        }
      }
    } catch (error) {
      console.error('[TripAPI] Error parsing route data:', {
        tripId: dbTrip.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Ensure end_time is valid - use start_time + duration if null
  const endTime = dbTrip.end_time || (dbTrip.start_time + (dbTrip.duration * 1000));

  // Validate timestamps
  if (!dbTrip.start_time || !endTime) {
    throw new Error(`Invalid timestamps for trip ${dbTrip.id}`);
  }

  if (dbTrip.start_time >= endTime) {
    throw new Error(`Invalid timestamps for trip ${dbTrip.id}: start time >= end time`);
  }

  const apiTrip: ApiTripCreate = {
    client_id: dbTrip.id,
    start_timestamp: new Date(dbTrip.start_time).toISOString(),
    end_timestamp: new Date(endTime).toISOString(),
    route: route || [], // Backend requires route field, use empty array if no route
    type: dbTrip.type,
    is_manual: dbTrip.is_manual === 1,
    status: dbTrip.status,
    elevation_gain: dbTrip.elevation_gain > 0 ? dbTrip.elevation_gain : undefined,
    classification_source: (dbTrip.classification_source as ApiTripCreate['classification_source']) ?? 'speed',
    user_note: dbTrip.user_note ?? undefined,
    elevation_loss: dbTrip.elevation_loss_m ?? undefined,
  };

  console.log(`[TripAPI] Transformed trip ${dbTrip.id}: type=${dbTrip.type}, source=${dbTrip.classification_source}, route=${route?.length ?? 0} pts`);

  return apiTrip;
}

/**
 * Trip API service
 */
class TripAPI {
  /**
   * Create a single trip on the backend
   */
  async createTrip(trip: ApiTripCreate): Promise<ApiTrip> {
    try {
      return await apiClient.post<ApiTrip>('/api/trips/', trip);
    } catch (error) {
      console.error('[TripAPI] Error creating trip:', error);
      throw error;
    }
  }

  /**
   * Sync multiple trips to the backend (bulk upload)
   * Uses the /api/trips/sync/ endpoint
   */
  async syncTrips(trips: ApiTripCreate[]): Promise<SyncResult> {
    try {
      console.log(`[TripAPI] Syncing ${trips.length} trips to /api/trips/sync/`);
      console.log('[TripAPI] Trip batch summary:', trips.map(t => ({
        client_id: t.client_id,
        type: t.type,
        is_manual: t.is_manual,
        status: t.status,
        start: t.start_timestamp,
        end: t.end_timestamp,
      })));

      const syncedTrips = await apiClient.post<ApiTrip[]>('/api/trips/sync/', trips);

      console.log(`[TripAPI] Successfully synced ${syncedTrips.length} trips`);
      console.log('[TripAPI] Synced trip IDs:', syncedTrips.map(t => t.client_id));

      return {
        success: true,
        synced: syncedTrips,
        failed: [],
      };
    } catch (error) {
      console.error('[TripAPI] Error syncing trips:', error);
      console.error('[TripAPI] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
      });

      // Try to extract response body if available
      if (error && typeof error === 'object' && 'response' in error) {
        const responseError = error as any;
        console.error('[TripAPI] HTTP Response:', {
          status: responseError.response?.status,
          statusText: responseError.response?.statusText,
          data: responseError.response?.data,
          headers: responseError.response?.headers,
        });

        // Log which trips failed if backend provided details
        if (responseError.response?.data) {
          console.error('[TripAPI] Backend error response:', JSON.stringify(responseError.response.data, null, 2));
        }
      }

      // If it's a network error, mark all as failed
      if (error instanceof Error && error.message.includes('Network')) {
        console.error('[TripAPI] Network error - marking all trips as failed');
        return {
          success: false,
          synced: [],
          failed: trips.map(trip => ({
            client_id: trip.client_id,
            error: error.message,
          })),
        };
      }

      throw error;
    }
  }

  /**
   * Get list of trips from backend
   */
  async getTrips(filters?: TripFilters): Promise<ApiTrip[]> {
    try {
      const params = new URLSearchParams();

      if (filters?.type) {
        params.append('type', filters.type);
      }
      if (filters?.status) {
        params.append('status', filters.status);
      }
      if (filters?.start_date) {
        params.append('start_date', filters.start_date);
      }
      if (filters?.end_date) {
        params.append('end_date', filters.end_date);
      }

      const queryString = params.toString();
      const endpoint = queryString ? `/api/trips/?${queryString}` : '/api/trips/';

      return await apiClient.get<ApiTrip[]>(endpoint);
    } catch (error) {
      // Session-expired errors are handled by the auth flow; don't show red LogBox
      if (error instanceof Error && error.message.includes('Session expired')) {
        console.warn('[TripAPI] Error fetching trips:', error);
      } else {
        console.error('[TripAPI] Error fetching trips:', error);
      }
      throw error;
    }
  }

  /**
   * Get a single trip by ID
   */
  async getTrip(id: number): Promise<ApiTrip> {
    try {
      return await apiClient.get<ApiTrip>(`/api/trips/${id}/`);
    } catch (error) {
      console.error('[TripAPI] Error fetching trip:', error);
      throw error;
    }
  }

  /**
   * Update a trip
   */
  async updateTrip(id: number, updates: Partial<ApiTripCreate> & { user_confirmed?: boolean | null }): Promise<ApiTrip> {
    try {
      return await apiClient.patch<ApiTrip>(`/api/trips/${id}/`, updates);
    } catch (error) {
      console.error('[TripAPI] Error updating trip:', error);
      throw error;
    }
  }

  /**
   * Delete a trip from backend
   */
  async deleteTrip(id: number): Promise<void> {
    try {
      await apiClient.delete(`/api/trips/${id}/`);
      console.log(`[TripAPI] Deleted trip ${id}`);
    } catch (error) {
      console.error('[TripAPI] Error deleting trip:', error);
      throw error;
    }
  }

  /**
   * Share a trip to one or more clubs.
   * Returns per-club results so the caller can surface partial failures.
   */
  async shareTrip(
    tripId: number,
    clubIds: number[],
    caption?: string
  ): Promise<{ results: TripShareResult[] }> {
    try {
      console.log(`[TripAPI] Sharing trip ${tripId} to clubs ${clubIds.join(', ')}`);
      return await apiClient.post<{ results: TripShareResult[] }>(
        `/api/trips/${tripId}/share/`,
        { club_ids: clubIds, caption }
      );
    } catch (error) {
      console.error('[TripAPI] Error sharing trip:', error);
      throw error;
    }
  }

  /**
   * Unshare a trip from a club.
   * Backend now expects club_id as a query parameter (not in body).
   */
  async unshareTrip(tripId: number, clubId: number): Promise<void> {
    try {
      console.log(`[TripAPI] Unsharing trip ${tripId} from club ${clubId}`);
      await apiClient.delete(`/api/trips/${tripId}/unshare/?club_id=${clubId}`);
    } catch (error) {
      console.error('[TripAPI] Error unsharing trip:', error);
      throw error;
    }
  }

  /**
   * Partially update a trip on the backend (dirty-field propagation)
   */
  async patchTrip(backendId: number, fields: Partial<ApiTripCreate>): Promise<ApiTrip> {
    return apiClient.patch<ApiTrip>(`/api/trips/${backendId}/`, fields);
  }

  /**
   * Upload a raw IMU sensor batch recorded during a trip. Used by the
   * frontend to ship the `sensor_batches` table to the backend for future
   * model retraining.
   *
   * The payload is an opaque JSON blob produced by `sensorBuffer.flushRawBatch`
   * — schema is owned by the backend endpoint and kept stable by contract.
   */
  async uploadSensorBatch(
    tripId: number,
    payload: unknown,
  ): Promise<void> {
    try {
      await apiClient.post(`/api/trips/${tripId}/sensor-data/`, payload);
    } catch (error) {
      console.error('[TripAPI] Error uploading sensor batch:', error);
      throw error;
    }
  }
}

export const tripAPI = new TripAPI();
