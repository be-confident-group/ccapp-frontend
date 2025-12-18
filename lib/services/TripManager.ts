/**
 * Trip Manager Service
 *
 * Manages trip lifecycle, statistics, and operations.
 * Handles both automatic background trips and manual entries.
 */

import { database, type Trip as DBTrip, type LocationPoint } from '../database';
import { LocationTrackingService } from './LocationTrackingService';
import {
  calculateDistance,
  calculateSpeed,
  calculateCO2Saved,
  calculateElevationGain,
  calculateElevationLoss,
  calculateCalories,
  stringifyRouteData,
  parseRouteData,
} from '../utils/geoCalculations';
import type { TripType, TripStats, ManualTripDto, TripFilters } from '../../types/trip';
import type { Coordinate } from '../../types/location';
import { syncService } from './SyncService';
import { trophyAPI, type Trophy } from '../api/trophies';
import { tripAPI } from '../api/trips';

export class TripManager {
  /**
   * Start a new automatic trip (for background tracking)
   * This is called automatically by LocationTrackingService
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

    // Update trip
    await database.updateTrip(tripId, {
      status: 'completed',
      type: dominantActivity,
      end_time: now,
      distance: stats.totalDistance,
      duration: stats.duration,
      avg_speed: stats.avgSpeed,
      max_speed: stats.maxSpeed,
      elevation_gain: stats.elevationGain,
      calories: stats.calories,
      co2_saved: stats.co2Saved,
      updated_at: now,
    });

    console.log(`[TripManager] Stopped trip ${tripId}`, {
      distance: stats.totalDistance,
      duration: stats.duration,
      type: dominantActivity,
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

    // Calculate stats from manual data
    const avgSpeed = calculateSpeed(data.distance, data.duration);
    const co2Saved = calculateCO2Saved(data.distance / 1000);
    const calories = calculateCalories(
      data.distance / 1000,
      data.type === 'run' ? 'running' : data.type === 'cycle' ? 'cycling' : 'walking',
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
      co2_saved: co2Saved,
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
  static calculateTripStats(locations: LocationPoint[]): TripStats {
    if (locations.length === 0) {
      return {
        totalDistance: 0,
        duration: 0,
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

      // Max speed (convert to km/h)
      const speedKmh = (loc.speed || 0) * 3.6;
      if (speedKmh > maxSpeed) {
        maxSpeed = speedKmh;
      }

      // Altitudes
      altitudes.push(loc.altitude);
    }

    // Duration in seconds
    const duration = (locations[locations.length - 1].timestamp - locations[0].timestamp) / 1000;

    // Average speed in km/h
    const avgSpeed = duration > 0 ? (totalDistance / duration) * 3.6 : 0;

    // Elevation
    const elevationGain = calculateElevationGain(altitudes);
    const elevationLoss = calculateElevationLoss(altitudes);

    // CO2 saved (kg)
    const co2Saved = calculateCO2Saved(totalDistance / 1000);

    // Calories (rough estimate)
    const calories = calculateCalories(
      totalDistance / 1000,
      'cycling', // Default to cycling
      70 // Default weight
    );

    return {
      totalDistance,
      duration,
      avgSpeed,
      maxSpeed,
      elevationGain,
      elevationLoss,
      co2Saved,
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

    return mapping[dominant] || 'walk';
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
