/**
 * Location Tracking Service
 *
 * Handles background location tracking using expo-location and expo-task-manager.
 * CRITICAL: TaskManager.defineTask MUST be called in GLOBAL SCOPE!
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { database, type LocationPoint } from '../database';
import { ActivityClassifier } from './ActivityClassifier';
import { TripDetectionService } from './TripDetectionService';
import { calculateDistance, mpsToKmh } from '../utils/geoCalculations';

const LOCATION_TASK_NAME = 'background-location-task';

// Track stationary state across task executions
let lastStationaryTime: number | null = null;

// ===== CRITICAL: GLOBAL SCOPE TASK DEFINITION =====
// This MUST be at top level, not inside class or function!
// When app wakes up in background, React components don't mount,
// but this global code executes.

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    // Check if it's a transient iOS location acquisition error (kCLErrorDomain Code=0)
    // This is normal during GPS initialization and shouldn't stop processing
    const errorCode = (error as any)?.code;
    if (errorCode === 0) {
      console.warn('[LocationTracking] Transient GPS acquisition (normal during startup)');
      // Don't return - continue processing if we have location data
    } else {
      // Real error - log and exit
      console.error('[LocationTracking] Task error:', error);
      return;
    }
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };

    // Check if locations array exists (might be undefined during transient errors)
    if (!locations || locations.length === 0) {
      console.log('[LocationTracking] No location data available');
      return;
    }

    console.log(`[LocationTracking] Received ${locations.length} location updates`);

    try {
      await processLocationUpdates(locations);
    } catch (err) {
      console.error('[LocationTracking] Error processing locations:', err);
    }
  }
});

/**
 * Process location updates from background task
 * This runs in background when app receives location updates
 */
async function processLocationUpdates(locations: Location.LocationObject[]) {
  // Initialize database
  await database.init();

  for (const location of locations) {
    const { latitude, longitude, altitude, accuracy, speed, heading } = location.coords;
    const timestamp = location.timestamp;
    const currentSpeed = speed || 0; // m/s

    console.log(
      `[LocationTracking] Location: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}, ` +
      `speed: ${mpsToKmh(currentSpeed).toFixed(1)} km/h`
    );

    // Get active trip
    let activeTrip = await database.getActiveTrip();

    // ===== TRIP START LOGIC =====
    if (!activeTrip) {
      // Check if we should start a new trip
      if (TripDetectionService.shouldStartTrip(currentSpeed)) {
        const tripId = `trip_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        // TODO: Get actual user ID from auth context
        // For now, use placeholder
        const userId = 'current_user';

        await database.createTrip({
          id: tripId,
          user_id: userId,
          status: 'active',
          start_time: timestamp,
          created_at: timestamp,
          updated_at: timestamp,
        });

        activeTrip = await database.getActiveTrip();
        lastStationaryTime = null; // Reset stationary tracking

        console.log(`[LocationTracking] ✓ Started new trip: ${tripId}`);
      } else {
        console.log('[LocationTracking] Not moving enough to start trip');
        continue;
      }
    }

    if (!activeTrip) {
      console.log('[LocationTracking] No active trip');
      continue;
    }

    // ===== STATIONARY DETECTION =====
    if (TripDetectionService.justBecameStationary(currentSpeed)) {
      if (!lastStationaryTime) {
        lastStationaryTime = timestamp;
        console.log('[LocationTracking] User became stationary');
      }
    } else {
      // User is moving again, reset stationary time
      lastStationaryTime = null;
    }

    // ===== CLASSIFY ACTIVITY =====
    const classification = ActivityClassifier.classifyBySpeed(currentSpeed);

    // ===== STORE LOCATION =====
    await database.addLocation({
      trip_id: activeTrip.id,
      latitude,
      longitude,
      altitude,
      accuracy,
      speed: currentSpeed,
      heading,
      timestamp,
      activity_type: classification.type,
      activity_confidence: classification.confidence,
      synced: 0,
    });

    console.log(
      `[LocationTracking] ✓ Stored location (${classification.type}, ${classification.confidence}% confidence)`
    );

    // ===== UPDATE TRIP STATS =====
    const allLocations = await database.getLocationsByTrip(activeTrip.id);
    const stats = calculateTripStatistics(allLocations);
    const dominantActivity = getDominantActivityType(allLocations);

    await database.updateTrip(activeTrip.id, {
      type: dominantActivity,
      distance: stats.totalDistance,
      duration: stats.duration,
      avg_speed: stats.avgSpeed,
      max_speed: stats.maxSpeed,
      elevation_gain: stats.elevationGain,
      co2_saved: stats.co2Saved,
      updated_at: timestamp,
    });

    // ===== CHECK IF SHOULD END TRIP =====
    if (
      TripDetectionService.shouldEndTrip(
        activeTrip.start_time,
        stats.totalDistance,
        lastStationaryTime,
        timestamp
      )
    ) {
      // Check if trip is significant enough to keep
      if (TripDetectionService.shouldDiscardTrip(stats.duration, stats.totalDistance)) {
        console.log('[LocationTracking] Trip too short, discarding');
        await database.updateTrip(activeTrip.id, {
          status: 'cancelled',
          end_time: timestamp,
          updated_at: timestamp,
        });
      } else {
        console.log('[LocationTracking] Ending trip (stationary for too long)');
        await database.updateTrip(activeTrip.id, {
          status: 'completed',
          end_time: timestamp,
          updated_at: timestamp,
        });
      }

      lastStationaryTime = null; // Reset for next trip
    }
  }
}

/**
 * Calculate trip statistics from location points
 */
function calculateTripStatistics(locations: LocationPoint[]) {
  if (locations.length === 0) {
    return {
      totalDistance: 0,
      duration: 0,
      avgSpeed: 0,
      maxSpeed: 0,
      elevationGain: 0,
      co2Saved: 0,
    };
  }

  let totalDistance = 0;
  let maxSpeed = 0;
  let elevationGain = 0;

  // Calculate cumulative distance, max speed, elevation gain
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

    // Elevation gain
    if (i > 0) {
      const prev = locations[i - 1];
      if (loc.altitude != null && prev.altitude != null && loc.altitude > prev.altitude) {
        elevationGain += loc.altitude - prev.altitude;
      }
    }
  }

  // Duration in seconds
  const duration = (locations[locations.length - 1].timestamp - locations[0].timestamp) / 1000;

  // Average speed in km/h
  const avgSpeed = duration > 0 ? (totalDistance / duration) * 3.6 : 0;

  // CO2 saved (kg) - assuming cycling/walking vs car (120g/km)
  const co2Saved = (totalDistance / 1000) * 0.12;

  return {
    totalDistance,
    duration,
    avgSpeed,
    maxSpeed,
    elevationGain,
    co2Saved,
  };
}

/**
 * Determine dominant activity type from locations
 */
function getDominantActivityType(locations: LocationPoint[]): 'walk' | 'run' | 'cycle' | 'drive' {
  const counts: Record<string, number> = {};

  for (const loc of locations) {
    if (loc.activity_type && loc.activity_type !== 'stationary') {
      counts[loc.activity_type] = (counts[loc.activity_type] || 0) + 1;
    }
  }

  // Find most common
  let maxCount = 0;
  let dominant = 'walk';

  for (const [activity, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      dominant = activity;
    }
  }

  // Map to Trip type
  const mapping: Record<string, 'walk' | 'run' | 'cycle' | 'drive'> = {
    walking: 'walk',
    running: 'run',
    cycling: 'cycle',
    driving: 'drive',
  };

  return mapping[dominant] || 'walk';
}

// ===== PUBLIC SERVICE CLASS =====

export interface TrackingConfig {
  accuracy?: Location.LocationAccuracy;
  distanceInterval?: number;
  showNotification?: boolean;
}

export class LocationTrackingService {
  /**
   * Check if background location tracking is currently active
   */
  static async isTracking(): Promise<boolean> {
    const registered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
    if (!registered) return false;

    const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    return started;
  }

  /**
   * Start background location tracking
   */
  static async startTracking(config: TrackingConfig = {}): Promise<void> {
    console.log('[LocationTracking] Starting background tracking...');

    // Check if already tracking
    if (await this.isTracking()) {
      console.log('[LocationTracking] Already tracking');
      return;
    }

    // Check permissions
    const { status: fgStatus } = await Location.getForegroundPermissionsAsync();
    const { status: bgStatus } = await Location.getBackgroundPermissionsAsync();

    if (fgStatus !== 'granted') {
      throw new Error('Foreground location permission not granted');
    }

    if (bgStatus !== 'granted') {
      console.warn(
        '[LocationTracking] Background permission not granted - tracking may stop when app is backgrounded'
      );
    }

    // Initialize database
    await database.init();

    // Start background location updates
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: config.accuracy || Location.Accuracy.Balanced,
      distanceInterval: config.distanceInterval || 50, // Update every 50 meters
      deferredUpdatesInterval: 60000, // Batch updates every 60s in background
      deferredUpdatesDistance: 100, // Or every 100m
      showsBackgroundLocationIndicator: true,

      // iOS-specific
      activityType: Location.ActivityType.Fitness,
      pausesUpdatesAutomatically: false,

      // Android-specific
      foregroundService:
        Platform.OS === 'android' && config.showNotification !== false
          ? {
              notificationTitle: 'Radzi is tracking your activity',
              notificationBody: 'Tap to return to app',
              notificationColor: '#1E88E5',
            }
          : undefined,
    });

    console.log('[LocationTracking] ✓ Background tracking started');
  }

  /**
   * Stop background location tracking
   */
  static async stopTracking(): Promise<void> {
    console.log('[LocationTracking] Stopping background tracking...');

    if (!(await this.isTracking())) {
      console.log('[LocationTracking] Not tracking');
      return;
    }

    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);

    // Reset stationary tracking
    lastStationaryTime = null;

    console.log('[LocationTracking] ✓ Background tracking stopped');
  }

  /**
   * Request location permissions (both foreground and background)
   */
  static async requestPermissions(): Promise<{
    foreground: Location.PermissionStatus;
    background: Location.PermissionStatus;
  }> {
    console.log('[LocationTracking] Requesting permissions...');

    // Request foreground first
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    console.log('[LocationTracking] Foreground permission:', fgStatus);

    // Only request background if foreground granted
    let bgStatus = Location.PermissionStatus.DENIED;
    if (fgStatus === Location.PermissionStatus.GRANTED) {
      const bg = await Location.requestBackgroundPermissionsAsync();
      bgStatus = bg.status;
      console.log('[LocationTracking] Background permission:', bgStatus);
    }

    return {
      foreground: fgStatus,
      background: bgStatus,
    };
  }

  /**
   * Check current permission status
   */
  static async checkPermissions(): Promise<{
    foreground: Location.PermissionStatus;
    background: Location.PermissionStatus;
  }> {
    const { status: fgStatus } = await Location.getForegroundPermissionsAsync();
    const { status: bgStatus } = await Location.getBackgroundPermissionsAsync();

    return {
      foreground: fgStatus,
      background: bgStatus,
    };
  }

  /**
   * Get current location (one-time)
   */
  static async getCurrentLocation(): Promise<Location.LocationObject | null> {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return location;
    } catch (error) {
      console.error('[LocationTracking] Error getting current location:', error);
      return null;
    }
  }

  /**
   * Get tracking status and statistics
   */
  static async getStatus(): Promise<{
    isTracking: boolean;
    activeTrip: any | null;
    permissions: {
      foreground: Location.PermissionStatus;
      background: Location.PermissionStatus;
    };
  }> {
    const isTracking = await this.isTracking();
    const permissions = await this.checkPermissions();
    const activeTrip = await database.getActiveTrip();

    return {
      isTracking,
      activeTrip,
      permissions,
    };
  }
}
