/**
 * Trip API service for backend integration
 */

import { apiClient } from './client';
import type { TripType, TripStatus } from '@/types/trip';

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
  notes?: string;
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
  elevation_gain?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  duration: number; // Backend calculated (seconds)
  co2_saved: number; // Backend calculated (kg)
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
}

/**
 * Transform frontend DB trip to backend API format
 */
export function transformTripForApi(dbTrip: DBTrip): ApiTripCreate {
  console.log('[TripAPI] Transforming trip:', {
    id: dbTrip.id,
    type: dbTrip.type,
    status: dbTrip.status,
    is_manual: dbTrip.is_manual,
    start_time: dbTrip.start_time,
    end_time: dbTrip.end_time,
    duration: dbTrip.duration,
  });

  // Validate trip type
  const validTypes = ['walk', 'run', 'cycle', 'drive'];
  if (!dbTrip.type || !validTypes.includes(dbTrip.type)) {
    console.error('[TripAPI] Invalid trip type:', {
      tripId: dbTrip.id,
      type: dbTrip.type,
      validTypes,
    });
    throw new Error(`Invalid trip type "${dbTrip.type}" for trip ${dbTrip.id}. Must be one of: ${validTypes.join(', ')}`);
  }

  // Parse route data from JSON string
  let route: ApiTripRoute[] | undefined = undefined;

  if (dbTrip.route_data) {
    try {
      const routeData = JSON.parse(dbTrip.route_data);
      if (Array.isArray(routeData) && routeData.length > 0) {
        console.log(`[TripAPI] Parsing ${routeData.length} route coordinates for trip ${dbTrip.id}`);
        console.log(`[TripAPI] First coordinate sample:`, routeData[0]);

        // Filter and validate coordinates
        // Support both {lat, lng} and {latitude, longitude} formats
        const validCoords = routeData.filter((coord: any, index: number) => {
          const lat = coord.lat ?? coord.latitude;
          const lng = coord.lng ?? coord.longitude;

          const isValid =
            lat != null &&
            lng != null &&
            !isNaN(lat) &&
            !isNaN(lng) &&
            lat >= -90 && lat <= 90 &&
            lng >= -180 && lng <= 180;

          if (!isValid) {
            console.warn(`[TripAPI] Invalid coordinate at index ${index}:`, coord);
          }

          return isValid;
        });

        if (validCoords.length > 0) {
          route = validCoords.map((coord: any) => {
            // Handle timestamp conversion safely
            let timestamp: string;
            try {
              // Check if timestamp exists and is valid
              if (coord.timestamp) {
                const date = new Date(coord.timestamp);
                if (isNaN(date.getTime())) {
                  // Invalid date, use current time as fallback
                  timestamp = new Date().toISOString();
                } else {
                  timestamp = date.toISOString();
                }
              } else {
                // No timestamp provided, use current time
                timestamp = new Date().toISOString();
              }
            } catch (e) {
              // Timestamp conversion failed, use current time
              timestamp = new Date().toISOString();
            }

            // Only include fields backend expects: lat, lng, timestamp
            return {
              lat: coord.lat ?? coord.latitude,
              lng: coord.lng ?? coord.longitude,
              timestamp,
            };
          });
          console.log(`[TripAPI] Transformed ${route.length} valid coordinates (${routeData.length - validCoords.length} invalid filtered out)`);
        } else {
          console.warn(`[TripAPI] All ${routeData.length} coordinates were invalid for trip ${dbTrip.id}`);
        }
      }
    } catch (error) {
      console.error('[TripAPI] Error parsing route data:', {
        tripId: dbTrip.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        routeDataLength: dbTrip.route_data?.length,
      });
    }
  }

  // Ensure end_time is valid - use start_time + duration if null
  const endTime = dbTrip.end_time || (dbTrip.start_time + (dbTrip.duration * 1000));

  // Validate timestamps
  if (!dbTrip.start_time || !endTime) {
    console.error('[TripAPI] Invalid timestamps for trip:', {
      tripId: dbTrip.id,
      start_time: dbTrip.start_time,
      end_time: dbTrip.end_time,
      duration: dbTrip.duration,
      computed_end_time: endTime,
    });
    throw new Error(`Invalid timestamps for trip ${dbTrip.id}`);
  }

  if (dbTrip.start_time >= endTime) {
    console.error('[TripAPI] Start time >= end time:', {
      tripId: dbTrip.id,
      start_time: dbTrip.start_time,
      end_time: endTime,
      start_iso: new Date(dbTrip.start_time).toISOString(),
      end_iso: new Date(endTime).toISOString(),
    });
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
    notes: dbTrip.notes || undefined,
  };

  console.log('[TripAPI] Transformed trip payload:', {
    client_id: apiTrip.client_id,
    type: apiTrip.type,
    status: apiTrip.status,
    is_manual: apiTrip.is_manual,
    start_timestamp: apiTrip.start_timestamp,
    end_timestamp: apiTrip.end_timestamp,
    route_points: route?.length || 0,
    elevation_gain: apiTrip.elevation_gain,
    has_notes: !!apiTrip.notes,
  });

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
  async updateTrip(id: number, updates: Partial<ApiTripCreate>): Promise<ApiTrip> {
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
   * Share a trip to a club
   */
  async shareTrip(
    tripId: number,
    clubId: number,
    title?: string,
    text?: string
  ): Promise<{ message: string; post_id: number }> {
    try {
      console.log(`[TripAPI] Sharing trip ${tripId} to club ${clubId}`);
      return await apiClient.post<{ message: string; post_id: number }>(
        `/api/trips/${tripId}/share/`,
        {
          club_id: clubId,
          title,
          text,
        }
      );
    } catch (error) {
      console.error('[TripAPI] Error sharing trip:', error);
      throw error;
    }
  }

  /**
   * Unshare a trip from a club
   */
  async unshareTrip(tripId: number, clubId: number): Promise<void> {
    try {
      console.log(`[TripAPI] Unsharing trip ${tripId} from club ${clubId}`);
      await apiClient.delete(`/api/trips/${tripId}/unshare/`, {
        body: JSON.stringify({ club_id: clubId }),
      } as any);
    } catch (error) {
      console.error('[TripAPI] Error unsharing trip:', error);
      throw error;
    }
  }
}

export const tripAPI = new TripAPI();
