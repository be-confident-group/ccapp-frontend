/**
 * Location Tracking Service
 *
 * Handles background location tracking using expo-location and expo-task-manager.
 * CRITICAL: TaskManager.defineTask MUST be called in GLOBAL SCOPE!
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform, AppState, AppStateStatus } from 'react-native';
import { database, type LocationPoint } from '../database';
import { ActivityClassifier } from './ActivityClassifier';
import { TripDetectionService } from './TripDetectionService';
import { calculateDistance, mpsToKmh } from '../utils/geoCalculations';

const LOCATION_TASK_NAME = 'background-location-task';

// Log module initialization (CRITICAL for debugging task timing)
console.log('[LocationTracking] ===== MODULE LOADED =====');
console.log('[LocationTracking] TaskManager.defineTask will be called at global scope');

// ===== TRACKING STATE =====
// Track stationary state across task executions
let lastStationaryTime: number | null = null;

// ===== APP STATE TRACKING =====
let appStateSubscription: { remove: () => void } | null = null;
let currentAppState: AppStateStatus = 'active';

// ===== GPS STABILIZATION =====
const MIN_ACCURACY_METERS = 100; // Reject points with accuracy worse than 100m (relaxed for real-world GPS)
const GPS_STABILIZATION_POINTS = 2; // Wait for 2 good readings before using (faster trip start)
let stabilizationBuffer: Location.LocationObject[] = [];
let isGpsStabilized = false;

// ===== ZOMBIE TRIP DETECTION =====
const ZOMBIE_TRIP_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

// ===== PERMISSION CHANGE CALLBACK =====
let onPermissionDowngraded: (() => void) | null = null;

// ===== FOREGROUND LOCATION WATCHER =====
// Provides real-time updates when app is in foreground (more reliable than background task)
let foregroundWatcher: Location.LocationSubscription | null = null;

// ===== HELPER FUNCTIONS =====

/**
 * Check if a location reading has acceptable accuracy
 */
function isLocationAccurate(location: Location.LocationObject): boolean {
  const accuracy = location.coords.accuracy;
  if (accuracy === null || accuracy === undefined) {
    return true; // Assume good if unknown
  }
  return accuracy <= MIN_ACCURACY_METERS;
}

/**
 * Handle GPS stabilization - wait for accurate readings before using data
 * Returns true if GPS is stabilized and location can be used
 */
function handleGpsStabilization(location: Location.LocationObject): boolean {
  if (isGpsStabilized) {
    return true;
  }

  if (isLocationAccurate(location)) {
    stabilizationBuffer.push(location);
    console.log(
      `[LocationTracking] GPS stabilization: ${stabilizationBuffer.length}/${GPS_STABILIZATION_POINTS} accurate readings`
    );

    if (stabilizationBuffer.length >= GPS_STABILIZATION_POINTS) {
      isGpsStabilized = true;
      console.log('[LocationTracking] GPS stabilized - ready to track');
      return true;
    }
  } else {
    console.log(
      `[LocationTracking] Skipping inaccurate point during stabilization: ${location.coords.accuracy}m`
    );
  }

  return false;
}

/**
 * Get the best (most accurate) location from the stabilization buffer
 */
function getBestInitialLocation(): Location.LocationObject | null {
  if (stabilizationBuffer.length === 0) {
    return null;
  }

  return stabilizationBuffer.reduce((best, current) => {
    const bestAccuracy = best.coords.accuracy || Infinity;
    const currentAccuracy = current.coords.accuracy || Infinity;
    return currentAccuracy < bestAccuracy ? current : best;
  });
}

/**
 * Reset GPS stabilization state (call when trip ends)
 */
function resetGpsStabilization(): void {
  stabilizationBuffer = [];
  isGpsStabilized = false;
}

/**
 * Initialize AppState listener for foreground/background transitions
 */
export function initializeAppStateListener(): void {
  if (appStateSubscription) {
    console.log('[LocationTracking] AppState listener already initialized');
    return;
  }

  appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
  currentAppState = AppState.currentState;
  console.log('[LocationTracking] AppState listener initialized, current state:', currentAppState);
}

/**
 * Clean up AppState listener
 */
export function cleanupAppStateListener(): void {
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
    console.log('[LocationTracking] AppState listener removed');
  }
}

/**
 * Handle app state changes (background <-> foreground)
 */
async function handleAppStateChange(nextAppState: AppStateStatus): Promise<void> {
  console.log(`[LocationTracking] AppState: ${currentAppState} -> ${nextAppState}`);

  const wasBackground = currentAppState === 'background' || currentAppState === 'inactive';
  const isNowForeground = nextAppState === 'active';
  const isNowBackground = nextAppState === 'background' || nextAppState === 'inactive';

  // App coming to foreground from background
  if (wasBackground && isNowForeground) {
    await handleForegroundResume();

    // Start foreground watcher if tracking is enabled
    const isTracking = await LocationTrackingService.isTracking();
    if (isTracking) {
      await startForegroundWatching();
    }
  }

  // App going to background
  if (!wasBackground && isNowBackground) {
    // Stop foreground watcher - rely on background task instead
    stopForegroundWatching();
    console.log('[LocationTracking] App going to background, stopped foreground watcher');
  }

  currentAppState = nextAppState;
}

/**
 * Handle app resuming to foreground
 * - Check for zombie trips
 * - Verify permissions haven't been revoked
 */
async function handleForegroundResume(): Promise<void> {
  console.log('[LocationTracking] App resumed to foreground');

  try {
    // Initialize database in case it's not ready
    await database.init();

    // Check for zombie trips
    await detectAndHandleZombieTrips();

    // Re-check permissions
    await checkPermissionRevocation();
  } catch (error) {
    console.error('[LocationTracking] Error handling foreground resume:', error);
  }
}

/**
 * Detect and handle zombie trips (active trips with no recent updates)
 */
async function detectAndHandleZombieTrips(): Promise<void> {
  const activeTrip = await database.getActiveTrip();
  if (!activeTrip) {
    return;
  }

  // Get locations for this trip to find the last update time
  const locations = await database.getLocationsByTrip(activeTrip.id);
  if (locations.length === 0) {
    // Trip has no locations - check if it's been too long since creation
    const timeSinceCreation = Date.now() - activeTrip.start_time;
    if (timeSinceCreation > ZOMBIE_TRIP_THRESHOLD_MS) {
      console.warn(`[LocationTracking] Zombie trip detected (no locations): ${activeTrip.id}`);
      await endZombieTrip(activeTrip.id, activeTrip.start_time);
    }
    return;
  }

  // Find the most recent location timestamp
  const lastLocation = locations[locations.length - 1];
  const timeSinceLastLocation = Date.now() - lastLocation.timestamp;

  if (timeSinceLastLocation > ZOMBIE_TRIP_THRESHOLD_MS) {
    console.warn(
      `[LocationTracking] Zombie trip detected: ${activeTrip.id}, ` +
      `last location ${Math.round(timeSinceLastLocation / 60000)} minutes ago`
    );
    await endZombieTrip(activeTrip.id, lastLocation.timestamp);
  }
}

/**
 * End a zombie trip
 */
async function endZombieTrip(tripId: string, endTime: number): Promise<void> {
  // Build route_data from existing locations for backend sync
  const locations = await database.getLocationsByTrip(tripId);
  const routeForSync = locations.map((loc) => ({
    lat: Number(loc.latitude.toFixed(6)),
    lng: Number(loc.longitude.toFixed(6)),
    timestamp: new Date(loc.timestamp).toISOString(),
  }));
  const routeDataJson = JSON.stringify(routeForSync);

  console.log(`[LocationTracking] Zombie trip ${tripId}: built route with ${routeForSync.length} points`);

  await database.updateTrip(tripId, {
    status: 'completed',
    end_time: endTime,
    route_data: routeDataJson,
    updated_at: Date.now(),
    notes: '[Auto-ended: background tracking timeout]',
  });

  // Reset tracking state
  lastStationaryTime = null;
  resetGpsStabilization();

  console.log(`[LocationTracking] Zombie trip ${tripId} ended`);
}

/**
 * Check if location permissions have been revoked or downgraded
 */
async function checkPermissionRevocation(): Promise<void> {
  const isTracking = await LocationTrackingService.isTracking();
  if (!isTracking) {
    return;
  }

  const permissions = await LocationTrackingService.checkPermissions();

  // Check if background permission was revoked
  if (permissions.background !== Location.PermissionStatus.GRANTED) {
    console.warn('[LocationTracking] Background permission revoked or downgraded!');

    // Call the callback if registered
    if (onPermissionDowngraded) {
      onPermissionDowngraded();
    }
  }
}

/**
 * Set callback for when permissions are downgraded
 */
export function setOnPermissionDowngraded(callback: (() => void) | null): void {
  onPermissionDowngraded = callback;
}

// ===== FOREGROUND LOCATION WATCHER =====

/**
 * Start foreground location watcher for real-time updates when app is active.
 * This is more reliable than background task for immediate location updates.
 */
export async function startForegroundWatching(): Promise<void> {
  if (foregroundWatcher) {
    console.log('[LocationTracking] Foreground watcher already active');
    return;
  }

  try {
    console.log('[LocationTracking] Starting foreground location watcher...');

    foregroundWatcher = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 3000, // Every 3 seconds
        distanceInterval: 5, // Or every 5 meters
      },
      async (location) => {
        console.log('[LocationTracking] Foreground watcher received location');
        // Process location the same way as background task
        if (isLocationAccurate(location)) {
          try {
            await processSingleLocationUpdate(location);
          } catch (err) {
            console.error('[LocationTracking] Error processing foreground location:', err);
          }
        } else {
          console.log(
            `[LocationTracking] Foreground: skipped inaccurate location (${location.coords.accuracy}m)`
          );
        }
      }
    );

    console.log('[LocationTracking] ✓ Foreground watcher started');
  } catch (error) {
    console.error('[LocationTracking] Failed to start foreground watcher:', error);
  }
}

/**
 * Stop foreground location watcher
 */
export function stopForegroundWatching(): void {
  if (foregroundWatcher) {
    foregroundWatcher.remove();
    foregroundWatcher = null;
    console.log('[LocationTracking] Foreground watcher stopped');
  }
}

/**
 * Check if foreground watcher is active
 */
export function isForegroundWatchingActive(): boolean {
  return foregroundWatcher !== null;
}

/**
 * Process a single location update (used by foreground watcher)
 */
async function processSingleLocationUpdate(location: Location.LocationObject): Promise<void> {
  await database.init();
  await processLocationUpdates([location]);
}

// ===== CRITICAL: GLOBAL SCOPE TASK DEFINITION =====
// This MUST be at top level, not inside class or function!
// When app wakes up in background, React components don't mount,
// but this global code executes.

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  console.log('[LocationTracking] ===== BACKGROUND TASK FIRED =====');
  console.log('[LocationTracking] Task data received:', {
    hasData: !!data,
    hasError: !!error,
    locationCount: data ? (data as any).locations?.length : 0,
  });

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

    // Log raw location data for debugging
    console.log('[LocationTracking] Raw locations received:', locations.map((loc, i) => ({
      index: i,
      lat: loc.coords.latitude.toFixed(6),
      lng: loc.coords.longitude.toFixed(6),
      accuracy: loc.coords.accuracy?.toFixed(0) || 'unknown',
      speed: loc.coords.speed?.toFixed(2) || 'unknown',
      timestamp: new Date(loc.timestamp).toISOString(),
    })));

    // Filter by accuracy - reject points with accuracy worse than threshold
    const accurateLocations = locations.filter(isLocationAccurate);
    const filteredCount = locations.length - accurateLocations.length;

    if (filteredCount > 0) {
      console.log(
        `[LocationTracking] Filtered ${filteredCount}/${locations.length} inaccurate locations (>${MIN_ACCURACY_METERS}m)`
      );
    }

    if (accurateLocations.length === 0) {
      console.log('[LocationTracking] All locations filtered due to low accuracy');
      return;
    }

    console.log(`[LocationTracking] Processing ${accurateLocations.length} accurate location updates`);

    try {
      await processLocationUpdates(accurateLocations);
    } catch (err) {
      console.error('[LocationTracking] Error processing locations:', err);
    }
  }
});

// Log task registration success
console.log('[LocationTracking] ===== TASK REGISTERED =====');
console.log('[LocationTracking] Background task name:', LOCATION_TASK_NAME);

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
    // iOS returns -1 for speed when unavailable, treat as 0
    const currentSpeed = speed != null && speed >= 0 ? speed : 0; // m/s

    console.log(
      `[LocationTracking] Location: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}, ` +
      `speed: ${mpsToKmh(currentSpeed).toFixed(1)} km/h, accuracy: ${accuracy?.toFixed(0) || 'unknown'}m`
    );

    // Get active trip
    let activeTrip = await database.getActiveTrip();

    // ===== TRIP START LOGIC =====
    if (!activeTrip) {
      // Check if we should start a new trip
      if (TripDetectionService.shouldStartTrip(currentSpeed)) {
        // Wait for GPS to stabilize before starting trip
        if (!handleGpsStabilization(location)) {
          console.log('[LocationTracking] Waiting for GPS to stabilize before starting trip');
          continue;
        }

        // Use the best location from stabilization buffer as start point
        const startLocation = getBestInitialLocation() || location;
        const startCoords = startLocation.coords;

        const tripId = `trip_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        // TODO: Get actual user ID from auth context
        // For now, use placeholder
        const userId = 'current_user';

        await database.createTrip({
          id: tripId,
          user_id: userId,
          status: 'active',
          start_time: startLocation.timestamp,
          created_at: startLocation.timestamp,
          updated_at: startLocation.timestamp,
        });

        activeTrip = await database.getActiveTrip();
        lastStationaryTime = null; // Reset stationary tracking

        console.log(
          `[LocationTracking] ✓ Started new trip: ${tripId} ` +
          `(using ${stabilizationBuffer.length} stabilization points, best accuracy: ${startCoords.accuracy?.toFixed(0) || 'unknown'}m)`
        );

        // Store all stabilization buffer locations as the trip's initial points
        for (const bufferedLoc of stabilizationBuffer) {
          const bufferedCoords = bufferedLoc.coords;
          const bufferedClassification = ActivityClassifier.classifyBySpeed(bufferedCoords.speed || 0);
          await database.addLocation({
            trip_id: tripId,
            latitude: bufferedCoords.latitude,
            longitude: bufferedCoords.longitude,
            altitude: bufferedCoords.altitude,
            accuracy: bufferedCoords.accuracy,
            speed: bufferedCoords.speed || 0,
            heading: bufferedCoords.heading,
            timestamp: bufferedLoc.timestamp,
            activity_type: bufferedClassification.type,
            activity_confidence: bufferedClassification.confidence,
            synced: 0,
          });
        }

        // Clear the stabilization buffer (but keep isGpsStabilized = true)
        stabilizationBuffer = [];
        continue; // Move to next location
      } else {
        // Not moving enough - reset stabilization if we have buffered points
        if (stabilizationBuffer.length > 0) {
          console.log('[LocationTracking] Speed dropped, resetting GPS stabilization');
          resetGpsStabilization();
        }
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

        // Build route_data for backend sync (ISO 8601 timestamps)
        const routeForSync = allLocations.map((loc) => ({
          lat: Number(loc.latitude.toFixed(6)),
          lng: Number(loc.longitude.toFixed(6)),
          timestamp: new Date(loc.timestamp).toISOString(),
        }));
        const routeDataJson = JSON.stringify(routeForSync);

        console.log(`[LocationTracking] Built route with ${routeForSync.length} points for sync`);

        await database.updateTrip(activeTrip.id, {
          status: 'completed',
          end_time: timestamp,
          route_data: routeDataJson,
          updated_at: timestamp,
        });
      }

      // Reset tracking state for next trip
      lastStationaryTime = null;
      resetGpsStabilization();
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
    // CRITICAL: Do NOT use deferredUpdatesInterval - iOS may never wake the app!
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.High, // High accuracy for fitness tracking
      timeInterval: 5000, // Request updates every 5 seconds
      distanceInterval: 10, // Or every 10 meters (reduced for better tracking)
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

    console.log('[LocationTracking] Config: timeInterval=5000ms, distanceInterval=10m, accuracy=High');

    console.log('[LocationTracking] ✓ Background tracking started');

    // Also start foreground watcher if app is in foreground for real-time updates
    if (currentAppState === 'active') {
      await startForegroundWatching();
    }
  }

  /**
   * Stop background location tracking
   */
  static async stopTracking(): Promise<void> {
    console.log('[LocationTracking] Stopping background tracking...');

    // Stop foreground watcher if active
    stopForegroundWatching();

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
