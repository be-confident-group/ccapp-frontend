/**
 * Trip Manager Service
 *
 * Manages trip lifecycle, statistics, and operations.
 * Handles both automatic background trips and manual entries.
 */

import * as Notifications from 'expo-notifications';
import { database, type Trip as DBTrip, type LocationPoint } from '../database';
import { MLSegmentDetector } from './MLSegmentDetector';
import {
  calculateDistance,
  calculateSpeed,
  calculateElevationGain,
  calculateElevationLoss,
  calculateCalories,
  stringifyRouteData,
  parseRouteData,
} from '../utils/geoCalculations';
import type { TripType, TripStats, ManualTripDto, TripFilters } from '../../types/trip';

interface CalculatedTripStats extends TripStats {
  elevationLoss: number;
  startTime: number;
  endTime: number | null;
}
import type { Coordinate } from '../../types/location';
import { syncService } from './SyncService';
import { trophyAPI, type Trophy } from '../api/trophies';
import { tripAPI } from '../api/trips';
import { TripValidationService } from './TripValidationService';

// ---------------------------------------------------------------------------
// Trip sync callback registry
// ---------------------------------------------------------------------------
type SyncCallback = () => void;
const tripSyncCallbacks: SyncCallback[] = [];

export function registerTripSyncCallback(cb: SyncCallback): () => void {
  tripSyncCallbacks.push(cb);
  return () => {
    const i = tripSyncCallbacks.indexOf(cb);
    if (i !== -1) tripSyncCallbacks.splice(i, 1);
  };
}

// ---------------------------------------------------------------------------
// Local notifications on trip completion
// ---------------------------------------------------------------------------
async function scheduleTripCompletionNotifications(
  tripId: number,
  distanceKm: number,
  tripType: string,
): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    const typeLabel = tripType === 'cycle' ? 'ride' : tripType === 'walk' ? 'walk' : tripType;
    const distanceStr = distanceKm >= 1
      ? `${distanceKm.toFixed(1)} km`
      : `${Math.round(distanceKm * 1000)} m`;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Trip saved! 🎉',
        body: `Great ${typeLabel}! You covered ${distanceStr}.`,
        data: { type: 'trip_completed', tripId },
      },
      trigger: null,
    });

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'How was your route? ⭐',
        body: 'Tap to rate your recent trip and help improve recommendations.',
        data: { type: 'rate_trip', tripId },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3600, repeats: false },
    });
  } catch (err) {
    console.warn('[TripManager] Failed to schedule trip notifications:', err);
  }
}

export class TripManager {
  /**
   * Start a new automatic trip (for background tracking)
   * This is called automatically by the background location task
   */
  static async startAutomaticTrip(userId: string, type?: TripType): Promise<string> {
    const tripId = `trip_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const now = Date.now();

    await database.createTrip({
      id: tripId,
      user_id: userId,
      type: type || 'walk',
      status: 'active',
      is_manual: 0,
      start_time: now,
      created_at: now,
      updated_at: now,
    });

    console.log(`[TripManager] Started automatic trip ${tripId}`);
    return tripId;
  }

  /**
   * Stop active trip and finalize statistics
   */
  static async stopTrip(tripId: string): Promise<{
    trip: DBTrip | null;
    synced: boolean;
    newTrophies: Trophy[];
  }> {
    const now = Date.now();

    // Get trip
    const trip = await database.getTrip(tripId);
    if (!trip) {
      console.error(`[TripManager] Trip ${tripId} not found`);
      return { trip: null, synced: false, newTrophies: [] };
    }

    // Get trip locations
    const locations = await database.getLocationsByTrip(tripId);

    if (locations.length === 0) {
      // No locations, mark as cancelled
      await database.updateTrip(tripId, {
        status: 'cancelled',
        end_time: now,
        updated_at: now,
      });
      console.log(`[TripManager] Trip ${tripId} cancelled (no locations)`);
      return {
        trip: await database.getTrip(tripId),
        synced: false,
        newTrophies: [],
      };
    }

    // Calculate final statistics
    const stats = this.calculateTripStats(locations);
    const dominantActivity = this.getDominantActivity(locations);

    // SEGMENT ANALYSIS: Detect multi-modal trips using ML, falling back to speed.
    console.log(`[TripManager] Analyzing trip ${tripId} for segments (ML-first)...`);
    const segmentAnalysis = await MLSegmentDetector.analyzeTrip(tripId, locations);
    const classificationMethod = segmentAnalysis.classificationMethod;

    console.log(`[TripManager] Segment analysis complete:`, {
      method: classificationMethod,
      mlWindows: segmentAnalysis.mlWindowCount,
      isMultiModal: segmentAnalysis.isMultiModal,
      segmentCount: segmentAnalysis.segments.length,
      types: segmentAnalysis.segments.map(s => s.type),
    });

    // If multi-modal, create separate trips for each segment
    if (segmentAnalysis.isMultiModal && segmentAnalysis.segments.length > 1) {
      console.log(`[TripManager] Multi-modal trip detected! Creating ${segmentAnalysis.segments.length} separate trips...`);

      const subTrips: DBTrip[] = [];
      const syncedSubTrips: string[] = [];

      // Minimum segment distances per class. Backend accepts all 4 types;
      // we still drop runs/drives that are too short to be meaningful data.
      const MIN_SEGMENT_DIST: Record<TripType, number> = {
        walk: 400,
        run: 400,
        cycle: 1000,
        drive: 1000,
      };

      for (let i = 0; i < segmentAnalysis.segments.length; i++) {
        const segment = segmentAnalysis.segments[i];
        const subTripId = `${tripId}_segment${i}`;

        const minDist = MIN_SEGMENT_DIST[segment.type] ?? 400;
        if (segment.distance < minDist) {
          console.log(`[TripManager] Skipping ${segment.type} segment ${i}: ${segment.distance.toFixed(0)}m < ${minDist}m`);
          continue;
        }

        console.log(`[TripManager] Creating sub-trip ${subTripId} (${segment.type}, ${segment.distance.toFixed(0)}m)`);

        // Build route data for this segment
        const segmentRouteForSync = segment.locations.map((loc) => ({
          lat: Number(loc.latitude.toFixed(6)),
          lng: Number(loc.longitude.toFixed(6)),
          timestamp: new Date(loc.timestamp).toISOString(),
        }));

        const segmentRouteDataJson = JSON.stringify(segmentRouteForSync);
        const segmentStartTime = segment.locations[0].timestamp;
        const segmentEndTime = segment.locations[segment.locations.length - 1].timestamp;

        // Calculate segment stats
        const segmentStats = this.calculateTripStats(segment.locations);

        // Create sub-trip
        await database.createTrip({
          id: subTripId,
          user_id: trip.user_id,
          type: segment.type,
          status: 'completed',
          is_manual: 0,
          start_time: segmentStartTime,
          end_time: segmentEndTime,
          distance: segment.distance,
          duration: segment.duration,
          avg_speed: segment.avgSpeed,
          max_speed: segment.maxSpeed,
          elevation_gain: segmentStats.elevationGain,
          calories: segmentStats.calories,
          co2_saved: 0, // Backend calculates CO2 (0.129 kg/km); populated via sync
          notes: `Segment ${i + 1} of ${segmentAnalysis.segments.length} (multi-modal trip)`,
          route_data: segmentRouteDataJson,
          created_at: now,
          updated_at: now,
          synced: 0,
          backend_id: null,
          ml_activity_type: classificationMethod === 'ml' ? segment.type : null,
          ml_confidence: classificationMethod === 'ml' ? segment.confidence / 100 : null,
          classification_method: classificationMethod,
        });

        const subTrip = await database.getTrip(subTripId);
        if (subTrip) {
          subTrips.push(subTrip);

          // Try to sync each sub-trip
          try {
            const synced = await syncService.syncSingleTrip(subTripId);
            if (synced) {
              syncedSubTrips.push(subTripId);
            }
          } catch (error) {
            console.error(`[TripManager] Error syncing sub-trip ${subTripId}:`, error);
          }
        }
      }

      // Mark original trip as cancelled (replaced by sub-trips)
      await database.updateTrip(tripId, {
        status: 'cancelled',
        end_time: now,
        notes: `Multi-modal trip split into ${subTrips.length} segments`,
        updated_at: now,
      });

      console.log(`[TripManager] Multi-modal trip processing complete. Created ${subTrips.length} trips, synced ${syncedSubTrips.length}`);

      // Fetch trophies if any sub-trip was synced
      let newTrophies: Trophy[] = [];
      if (syncedSubTrips.length > 0) {
        try {
          newTrophies = await trophyAPI.getNewTrophies();
        } catch (error) {
          console.error('[TripManager] Error fetching trophies:', error);
        }
      }

      return {
        trip: await database.getTrip(tripId),
        synced: syncedSubTrips.length > 0,
        newTrophies,
      };
    }

    // Single-modal trip - continue with normal validation.
    // Prefer the ML-derived dominant type when ML ran; fall back to speed-based.
    const finalType: TripType =
      classificationMethod === 'ml' && segmentAnalysis.dominantType
        ? segmentAnalysis.dominantType
        : dominantActivity;

    console.log(
      `[TripManager] Single-modal trip (${finalType}, via ${classificationMethod}), continuing with normal processing...`,
    );

    // Ensure DB has the final dominant type and key stats before validation reads them
    await database.updateTrip(tripId, {
      type: finalType,
      distance: stats.totalDistance,
      max_speed: stats.maxSpeed,
      ml_activity_type: classificationMethod === 'ml' ? finalType : null,
      ml_confidence: classificationMethod === 'ml' ? segmentAnalysis.confidence / 100 : null,
      classification_method: classificationMethod,
      updated_at: now,
    });

    // Validate and finalize trip (checks distance, type, speed, GPS drift; writes route_data)
    const validationResult = await TripValidationService.validateAndFinalizeTrip(tripId, now, {
      type: finalType,
      distance: stats.totalDistance,
      duration: stats.totalDuration,
      avg_speed: stats.avgSpeed,
      max_speed: stats.maxSpeed,
      elevation_gain: stats.elevationGain,
      calories: stats.calories,
      co2_saved: stats.co2Saved,
    });

    if (!validationResult.isValid) {
      console.log(`[TripManager] Trip ${tripId} cancelled: ${validationResult.reason}`);
      return {
        trip: await database.getTrip(tripId),
        synced: false,
        newTrophies: [],
      };
    }

    console.log(`[TripManager] Stopped trip ${tripId}`, {
      distance: stats.totalDistance,
      duration: stats.totalDuration,
      type: finalType,
      method: classificationMethod,
    });

    const completedTrip = await database.getTrip(tripId);

    // Attempt to sync trip to backend
    let synced = false;
    let newTrophies: Trophy[] = [];

    try {
      synced = await syncService.syncSingleTrip(tripId);

      if (synced) {
        console.log(`[TripManager] Trip synced successfully, fetching trophies...`);
        // Fetch new trophies after successful sync
        newTrophies = await trophyAPI.getNewTrophies();
        if (newTrophies.length > 0) {
          console.log(`[TripManager] Earned ${newTrophies.length} new trophies!`);
        }
        // Notify React Query subscribers to invalidate home-messages cache
        tripSyncCallbacks.forEach((cb) => cb());
        // Schedule local push notifications for trip completion
        const completedTripData = await database.getTrip(tripId);
        if (completedTripData?.backend_id) {
          void scheduleTripCompletionNotifications(
            completedTripData.backend_id,
            completedTripData.distance / 1000,
            completedTripData.type,
          );
        }
      }
    } catch (error) {
      console.error('[TripManager] Error during sync or trophy fetch:', error);
      // Don't fail the trip completion if sync fails
    }

    return {
      trip: completedTrip,
      synced,
      newTrophies,
    };
  }

  /**
   * Pause active trip
   */
  static async pauseTrip(tripId: string): Promise<void> {
    await database.updateTrip(tripId, {
      status: 'paused',
      updated_at: Date.now(),
    });
    console.log(`[TripManager] Paused trip ${tripId}`);
  }

  /**
   * Resume paused trip
   */
  static async resumeTrip(tripId: string): Promise<void> {
    await database.updateTrip(tripId, {
      status: 'active',
      updated_at: Date.now(),
    });
    console.log(`[TripManager] Resumed trip ${tripId}`);
  }

  /**
   * Get current active trip
   */
  static async getActiveTrip(): Promise<DBTrip | null> {
    return await database.getActiveTrip();
  }

  /**
   * Get trip by ID
   */
  static async getTrip(tripId: string): Promise<DBTrip | null> {
    return await database.getTrip(tripId);
  }

  /**
   * Get trip with full details (including route)
   */
  static async getTripDetails(tripId: string): Promise<{
    trip: DBTrip;
    route: Coordinate[];
    locationCount: number;
  } | null> {
    const trip = await database.getTrip(tripId);
    if (!trip) return null;

    // For manual trips with route_data, use that
    if (trip.route_data) {
      const route = parseRouteData(trip.route_data);
      return {
        trip,
        route,
        locationCount: route.length,
      };
    }

    // For automatic trips, get from locations table
    const locations = await database.getLocationsByTrip(tripId);
    const route = locations.map((loc) => ({
      latitude: loc.latitude,
      longitude: loc.longitude,
    }));

    return {
      trip,
      route,
      locationCount: locations.length,
    };
  }

  /**
   * Get all trips with optional filters
   */
  static async getAllTrips(filters?: TripFilters): Promise<DBTrip[]> {
    const dbFilters: any = {};

    if (filters) {
      if (filters.type) dbFilters.type = filters.type;
      if (filters.status) dbFilters.status = filters.status;
      if (filters.synced !== undefined) dbFilters.synced = filters.synced;
      if (filters.startDate) dbFilters.startDate = filters.startDate;
      if (filters.endDate) dbFilters.endDate = filters.endDate;
    }

    return await database.getAllTrips(dbFilters);
  }

  /**
   * Update trip details
   */
  static async updateTrip(
    tripId: string,
    updates: {
      type?: TripType;
      notes?: string;
      status?: 'active' | 'paused' | 'completed' | 'cancelled';
    }
  ): Promise<DBTrip | null> {
    await database.updateTrip(tripId, {
      ...updates,
      updated_at: Date.now(),
    });

    console.log(`[TripManager] Updated trip ${tripId}`, updates);
    return await database.getTrip(tripId);
  }

  /**
   * Delete trip and all associated locations
   * If the trip was synced, also delete from backend
   */
  static async deleteTrip(tripId: string): Promise<void> {
    try {
      // Get the trip to check if it was synced to backend
      const trip = await database.getTrip(tripId);

      if (!trip) {
        console.error(`[TripManager] Trip ${tripId} not found`);
        throw new Error(`Trip ${tripId} not found`);
      }

      // If trip was synced and has backend_id, delete from backend first
      if (trip.synced === 1 && trip.backend_id) {
        console.log(`[TripManager] Deleting trip ${tripId} from backend (backend_id: ${trip.backend_id})`);
        try {
          await tripAPI.deleteTrip(trip.backend_id);
          console.log(`[TripManager] Successfully deleted trip from backend`);
        } catch (error) {
          console.error(`[TripManager] Failed to delete trip from backend:`, error);
          // Continue with local deletion even if backend deletion fails
          // This could happen if the trip was already deleted on backend or network is unavailable
        }
      }

      // Delete from local database
      await database.deleteTrip(tripId);
      console.log(`[TripManager] Deleted trip ${tripId} from local database`);
    } catch (error) {
      console.error(`[TripManager] Error deleting trip ${tripId}:`, error);
      throw error;
    }
  }

  /**
   * Create manual trip entry
   */
  static async createManualTrip(data: ManualTripDto): Promise<{
    trip: DBTrip;
    synced: boolean;
    newTrophies: Trophy[];
  }> {
    const tripId = `manual_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const now = Date.now();

    // Validate manual trip against quality thresholds
    const MIN_WALK_DISTANCE = 400; // meters
    const MIN_RIDE_DISTANCE = 1000; // meters (1 km)

    // Check minimum distances
    if (data.type === 'walk' && data.distance < MIN_WALK_DISTANCE) {
      throw new Error(`Walk distance (${data.distance.toFixed(0)}m) is below minimum (${MIN_WALK_DISTANCE}m)`);
    }

    if (data.type === 'cycle' && data.distance < MIN_RIDE_DISTANCE) {
      throw new Error(`Ride distance (${data.distance.toFixed(0)}m) is below minimum (${MIN_RIDE_DISTANCE}m)`);
    }

    // Reject run and drive types
    if (data.type === 'run' || data.type === 'drive') {
      throw new Error(`Trip type '${data.type}' not supported (only walk/cycle allowed)`);
    }

    // Calculate stats from manual data
    const avgSpeed = calculateSpeed(data.distance, data.duration);
    const calories = calculateCalories(
      data.distance / 1000,
      data.type === 'cycle' ? 'cycling' : 'walking',
      70 // Default weight
    );

    // Create trip
    await database.createTrip({
      id: tripId,
      user_id: data.userId,
      type: data.type,
      status: 'completed',
      is_manual: 1,
      start_time: data.startTime,
      end_time: data.startTime + data.duration * 1000,
      distance: data.distance,
      duration: data.duration,
      avg_speed: avgSpeed,
      max_speed: avgSpeed, // For manual entries, max = avg
      elevation_gain: 0,
      calories,
      co2_saved: 0, // Backend calculates CO2 (0.129 kg/km); populated via sync
      notes: data.notes || null,
      route_data: data.routeData ? stringifyRouteData(data.routeData) : null,
      created_at: now,
      updated_at: now,
      synced: 0,
    });

    console.log(`[TripManager] Created manual trip ${tripId}`, {
      type: data.type,
      distance: data.distance,
      duration: data.duration,
    });

    const trip = (await database.getTrip(tripId))!;

    // Attempt to sync trip to backend
    let synced = false;
    let newTrophies: Trophy[] = [];

    try {
      synced = await syncService.syncSingleTrip(tripId);

      if (synced) {
        console.log(`[TripManager] Manual trip synced successfully, fetching trophies...`);
        // Fetch new trophies after successful sync
        newTrophies = await trophyAPI.getNewTrophies();
        if (newTrophies.length > 0) {
          console.log(`[TripManager] Earned ${newTrophies.length} new trophies!`);
        }
        // Notify React Query subscribers to invalidate home-messages cache
        tripSyncCallbacks.forEach((cb) => cb());
        // Schedule local push notifications for trip completion
        const updatedTrip = await database.getTrip(tripId);
        if (updatedTrip?.backend_id) {
          void scheduleTripCompletionNotifications(
            updatedTrip.backend_id,
            updatedTrip.distance / 1000,
            updatedTrip.type,
          );
        }
      }
    } catch (error) {
      console.error('[TripManager] Error during sync or trophy fetch:', error);
      // Don't fail the trip creation if sync fails
    }

    return {
      trip,
      synced,
      newTrophies,
    };
  }

  /**
   * Manually sync all pending trips to backend
   * Returns sync result with counts and errors
   */
  static async syncAllPendingTrips() {
    console.log('[TripManager] Manually syncing all pending trips...');
    return await syncService.syncTrips();
  }

  /**
   * Get sync status (unsynced count, last sync time, etc.)
   */
  static async getSyncStatus() {
    return await syncService.getSyncStatus();
  }

  /**
   * Calculate trip statistics from location points
   */
  static calculateTripStats(locations: LocationPoint[]): CalculatedTripStats {
    if (locations.length === 0) {
      return {
        totalDistance: 0,
        totalDuration: 0,
        avgSpeed: 0,
        maxSpeed: 0,
        elevationGain: 0,
        elevationLoss: 0,
        co2Saved: 0,
        calories: 0,
        startTime: Date.now(),
        endTime: null,
      };
    }

    let totalDistance = 0;
    let maxSpeed = 0;
    const altitudes: (number | null)[] = [];

    // Calculate cumulative distance, max speed, collect altitudes
    for (let i = 0; i < locations.length; i++) {
      const loc = locations[i];

      // Distance
      if (i > 0) {
        const prev = locations[i - 1];
        const dist = calculateDistance(
          { latitude: prev.latitude, longitude: prev.longitude },
          { latitude: loc.latitude, longitude: loc.longitude }
        );
        totalDistance += dist;
      }

      // Max speed: use device speed but cross-check against calculated speed between points
      const deviceSpeedKmh = (loc.speed || 0) * 3.6;
      let pointMaxSpeed = deviceSpeedKmh;
      if (i > 0) {
        const prev = locations[i - 1];
        const segTimeDiff = (loc.timestamp - prev.timestamp) / 1000;
        if (segTimeDiff > 0) {
          const dist = calculateDistance(
            { latitude: prev.latitude, longitude: prev.longitude },
            { latitude: loc.latitude, longitude: loc.longitude }
          );
          const calculatedSpeedKmh = (dist / segTimeDiff) * 3.6;
          pointMaxSpeed = Math.min(deviceSpeedKmh, calculatedSpeedKmh * 1.5);
        }
      }
      if (pointMaxSpeed > maxSpeed) {
        maxSpeed = pointMaxSpeed;
      }

      // Altitudes
      altitudes.push(loc.altitude);
    }

    // Duration in seconds
    const totalDuration = (locations[locations.length - 1].timestamp - locations[0].timestamp) / 1000;

    // Average speed in km/h
    const avgSpeed = totalDuration > 0 ? (totalDistance / totalDuration) * 3.6 : 0;

    // Elevation
    const elevationGain = calculateElevationGain(altitudes);
    const elevationLoss = calculateElevationLoss(altitudes);

    // Calories (rough estimate)
    const calories = calculateCalories(
      totalDistance / 1000,
      'cycling', // Default to cycling
      70 // Default weight
    );

    return {
      totalDistance,
      totalDuration,
      avgSpeed,
      maxSpeed,
      elevationGain,
      elevationLoss,
      co2Saved: 0, // Backend calculates CO2 (0.129 kg/km); populated via sync
      calories,
      startTime: locations[0].timestamp,
      endTime: locations[locations.length - 1].timestamp,
    };
  }

  /**
   * Determine dominant activity type from locations
   */
  static getDominantActivity(locations: LocationPoint[]): TripType {
    const counts: Record<string, number> = {};

    for (const loc of locations) {
      if (loc.activity_type && loc.activity_type !== 'stationary') {
        counts[loc.activity_type] = (counts[loc.activity_type] || 0) + 1;
      }
    }

    // Find most common
    let maxCount = 0;
    let dominant = 'walking';

    for (const [activity, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        dominant = activity;
      }
    }

    // Map to TripType
    const mapping: Record<string, TripType> = {
      walking: 'walk',
      running: 'run',
      cycling: 'cycle',
      driving: 'drive',
    };

    const mappedType = mapping[dominant] || 'walk';

    // Transit override: if calculated avg speed suggests transit but per-point classification says walking,
    // the user is likely on a train/bus where GPS device speed reads ~0
    if (mappedType === 'walk' && locations.length >= 2) {
      const duration = (locations[locations.length - 1].timestamp - locations[0].timestamp) / 1000;
      if (duration > 0) {
        let totalDist = 0;
        for (let i = 1; i < locations.length; i++) {
          totalDist += calculateDistance(
            { latitude: locations[i - 1].latitude, longitude: locations[i - 1].longitude },
            { latitude: locations[i].latitude, longitude: locations[i].longitude }
          );
        }
        const calcAvgSpeedKmh = (totalDist / duration) * 3.6;
        if (calcAvgSpeedKmh > 10) {
          console.log(
            `[TripManager] Transit override: avg speed ${calcAvgSpeedKmh.toFixed(1)} km/h but classified as walking`
          );
          return 'drive';
        }
      }
    }

    return mappedType;
  }

  /**
   * Get trip statistics summary for user
   */
  static async getUserStats(userId: string): Promise<{
    totalTrips: number;
    totalDistance: number;
    totalDuration: number;
    totalCO2Saved: number;
    totalCalories: number;
    currentStreak: number;
    longestStreak: number;
  }> {
    const trips = await database.getAllTrips({ status: 'completed' });

    let totalDistance = 0;
    let totalDuration = 0;
    let totalCO2Saved = 0;
    let totalCalories = 0;

    for (const trip of trips) {
      totalDistance += trip.distance;
      totalDuration += trip.duration;
      totalCO2Saved += trip.co2_saved;
      totalCalories += trip.calories;
    }

    // Calculate streaks (simplified - consecutive days with trips)
    const currentStreak = 0; // TODO: Implement streak calculation
    const longestStreak = 0; // TODO: Implement streak calculation

    return {
      totalTrips: trips.length,
      totalDistance,
      totalDuration,
      totalCO2Saved,
      totalCalories,
      currentStreak,
      longestStreak,
    };
  }

  /**
   * Export trip data for sharing
   */
  static async exportTrip(tripId: string): Promise<{
    trip: DBTrip;
    route: Coordinate[];
    gpx?: string;
  } | null> {
    const details = await this.getTripDetails(tripId);
    if (!details) return null;

    // TODO: Generate GPX format for export
    const gpx = undefined;

    return {
      trip: details.trip,
      route: details.route,
      gpx,
    };
  }

  /**
   * Get recent trips (last N trips)
   */
  static async getRecentTrips(limit: number = 10): Promise<DBTrip[]> {
    const allTrips = await database.getAllTrips({ status: 'completed' });
    return allTrips.slice(0, limit);
  }

  /**
   * Get trips for a specific date range
   */
  static async getTripsInRange(startDate: number, endDate: number): Promise<DBTrip[]> {
    return await database.getAllTrips({
      startDate,
      endDate,
      status: 'completed',
    });
  }

  /**
   * Get trips by type
   */
  static async getTripsByType(type: TripType): Promise<DBTrip[]> {
    return await database.getAllTrips({ type, status: 'completed' });
  }
}
