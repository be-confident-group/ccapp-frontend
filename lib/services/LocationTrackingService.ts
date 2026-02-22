/**
 * Location Tracking Service
 *
 * Handles background location tracking using expo-location and expo-task-manager.
 * CRITICAL: TaskManager.defineTask MUST be called in GLOBAL SCOPE!
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform, AppState, AppStateStatus } from 'react-native';
import { database, type LocationPoint } from '../database';
import { ActivityClassifier } from './ActivityClassifier';
import { TripDetectionService } from './TripDetectionService';
import { syncService } from './SyncService';
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
const TRIP_START_ACCURACY_METERS = 200; // Relaxed threshold for detecting movement before a trip starts
const GPS_STABILIZATION_POINTS = 2; // Wait for 2 good readings before using (faster trip start)
const GPS_STABILIZATION_TIMEOUT_MS = 15000; // 15 seconds
let stabilizationBuffer: Location.LocationObject[] = [];
let isGpsStabilized = false;
let stabilizationStartTime: number | null = null;
let bestStabilizationLocation: Location.LocationObject | null = null;

// ===== GPS OUTLIER DETECTION =====
const MAX_POSSIBLE_SPEED_MPS = 50; // 180 km/h - absolute physical limit for any valid trip point
let lastStoredLocation: { latitude: number; longitude: number; timestamp: number } | null = null;

// ===== SPEED CALCULATION FROM CONSECUTIVE POINTS =====
let previousLocationForSpeed: { latitude: number; longitude: number; timestamp: number } | null = null;

// ===== ZOMBIE TRIP DETECTION =====
const ZOMBIE_TRIP_THRESHOLD_MS = 45 * 60 * 1000; // 45 minutes — covers stops at shops, cafes, etc.

// ===== TRACKING ERROR AND TASK LOG =====
const TRACKING_ERROR_LOG_KEY = '@tracking_errors';
const TRACKING_TASK_LOG_KEY = '@tracking_task_log';
const MAX_ERROR_LOG_ENTRIES = 20;
const MAX_TASK_LOG_ENTRIES = 50;
const TRACKING_PREFERENCE_KEY = '@tracking_preference_enabled';

/**
 * Persistently log a background task error for later diagnosis in the debug panel.
 */
async function logTrackingError(error: unknown): Promise<void> {
  try {
    const entry = {
      timestamp: new Date().toISOString(),
      platform: Platform.OS,
      platformVersion: String(Platform.Version),
      error: error instanceof Error
        ? { message: error.message, name: error.name }
        : String(error),
    };
    const raw = await AsyncStorage.getItem(TRACKING_ERROR_LOG_KEY);
    const existing: typeof entry[] = raw ? JSON.parse(raw) : [];
    const updated = [entry, ...existing].slice(0, MAX_ERROR_LOG_ENTRIES);
    await AsyncStorage.setItem(TRACKING_ERROR_LOG_KEY, JSON.stringify(updated));
  } catch {
    // Never let logging crash the tracking task
  }
}

/**
 * Log a successful background task execution (for Android diagnostics).
 */
async function logBackgroundTaskExecution(locationCount: number): Promise<void> {
  try {
    const entry = {
      timestamp: new Date().toISOString(),
      platform: Platform.OS,
      locationCount,
    };
    const raw = await AsyncStorage.getItem(TRACKING_TASK_LOG_KEY);
    const existing: typeof entry[] = raw ? JSON.parse(raw) : [];
    const updated = [entry, ...existing].slice(0, MAX_TASK_LOG_ENTRIES);
    await AsyncStorage.setItem(TRACKING_TASK_LOG_KEY, JSON.stringify(updated));
  } catch {
    // Never let logging crash the tracking task
  }
}

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

  // Track when stabilization started
  if (stabilizationStartTime === null) {
    stabilizationStartTime = Date.now();
  }

  // Track best location seen so far (even if not "accurate" enough)
  if (
    !bestStabilizationLocation ||
    (location.coords.accuracy ?? Infinity) < (bestStabilizationLocation.coords.accuracy ?? Infinity)
  ) {
    bestStabilizationLocation = location;
  }

  // Normal path: collect accurate readings
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
  }

  // Timeout path: use best available location
  const elapsed = Date.now() - stabilizationStartTime;
  if (elapsed >= GPS_STABILIZATION_TIMEOUT_MS) {
    console.warn(
      `[LocationTracking] GPS stabilization timeout (${(elapsed / 1000).toFixed(0)}s). ` +
      `Using best available point (accuracy: ${bestStabilizationLocation?.coords.accuracy?.toFixed(0) ?? 'unknown'}m)`
    );
    if (bestStabilizationLocation && stabilizationBuffer.length === 0) {
      stabilizationBuffer.push(bestStabilizationLocation);
    }
    isGpsStabilized = true;
    return true;
  }

  console.log(
    `[LocationTracking] Waiting for GPS stabilization (${(elapsed / 1000).toFixed(0)}s elapsed, ` +
    `accuracy: ${location.coords.accuracy?.toFixed(0) ?? 'unknown'}m)`
  );

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
  stabilizationStartTime = null;
  bestStabilizationLocation = null;
  resetLastStoredLocation();
  previousLocationForSpeed = null;
}

/**
 * Check if a new GPS point is physically plausible given the previous stored point.
 * Rejects points where the implied speed exceeds MAX_POSSIBLE_SPEED_MPS (GPS signal loss/re-acquisition).
 */
function isPointPhysicallyPlausible(
  newLat: number,
  newLng: number,
  newTimestamp: number
): boolean {
  if (!lastStoredLocation) {
    return true; // First point, always accept
  }

  const timeDiffSeconds = (newTimestamp - lastStoredLocation.timestamp) / 1000;
  if (timeDiffSeconds <= 0) {
    return true; // Same or backwards timestamp, let other logic handle
  }

  const distance = calculateDistance(
    { latitude: lastStoredLocation.latitude, longitude: lastStoredLocation.longitude },
    { latitude: newLat, longitude: newLng }
  );

  const impliedSpeedMps = distance / timeDiffSeconds;

  if (impliedSpeedMps > MAX_POSSIBLE_SPEED_MPS) {
    console.warn(
      `[LocationTracking] GPS OUTLIER REJECTED: ${(impliedSpeedMps * 3.6).toFixed(1)} km/h ` +
      `between points ${timeDiffSeconds.toFixed(0)}s apart, ${distance.toFixed(0)}m distance`
    );
    return false;
  }

  return true;
}

function updateLastStoredLocation(lat: number, lng: number, timestamp: number): void {
  lastStoredLocation = { latitude: lat, longitude: lng, timestamp };
}

function resetLastStoredLocation(): void {
  lastStoredLocation = null;
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

    // Clean up any invalid trips in local DB (GPS drift, too short, etc.)
    await syncService.cleanupInvalidTrips();

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
 * End a zombie trip with proper validation
 */
async function endZombieTrip(tripId: string, endTime: number): Promise<void> {
  const locations = await database.getLocationsByTrip(tripId);
  const now = Date.now();

  if (locations.length < 2) {
    await database.updateTrip(tripId, {
      status: 'cancelled',
      end_time: endTime,
      notes: '[Auto-ended zombie] No locations recorded',
      updated_at: now,
    });
    console.log(`[LocationTracking] Zombie trip ${tripId} cancelled: no locations`);
    lastStationaryTime = null;
    resetGpsStabilization();
    TripDetectionService.resetState();
    return;
  }

  // Calculate stats and determine type
  const stats = calculateTripStatistics(locations);
  const dominantActivity = getDominantActivityType(locations);

  // Validate minimum distances and types
  const MIN_WALK_DISTANCE = 400;
  const MIN_RIDE_DISTANCE = 1000;
  let cancelReason: string | null = null;

  if (dominantActivity === 'walk' && stats.totalDistance < MIN_WALK_DISTANCE) {
    cancelReason = `Walk distance (${stats.totalDistance.toFixed(0)}m) below minimum (${MIN_WALK_DISTANCE}m)`;
  } else if (dominantActivity === 'cycle' && stats.totalDistance < MIN_RIDE_DISTANCE) {
    cancelReason = `Ride distance (${stats.totalDistance.toFixed(0)}m) below minimum (${MIN_RIDE_DISTANCE}m)`;
  } else if (dominantActivity === 'drive' || dominantActivity === 'run') {
    cancelReason = `Trip type '${dominantActivity}' not supported`;
  }

  if (cancelReason) {
    await database.updateTrip(tripId, {
      status: 'cancelled',
      end_time: endTime,
      notes: `[Auto-ended zombie] ${cancelReason}`,
      updated_at: now,
    });
    console.log(`[LocationTracking] Zombie trip ${tripId} cancelled: ${cancelReason}`);
  } else {
    // Build route_data from existing locations for backend sync
    const routeForSync = locations.map((loc) => ({
      lat: Number(loc.latitude.toFixed(6)),
      lng: Number(loc.longitude.toFixed(6)),
      timestamp: new Date(loc.timestamp).toISOString(),
    }));

    await database.updateTrip(tripId, {
      status: 'completed',
      end_time: endTime,
      type: dominantActivity,
      distance: stats.totalDistance,
      duration: stats.duration,
      avg_speed: stats.avgSpeed,
      max_speed: stats.maxSpeed,
      route_data: JSON.stringify(routeForSync),
      notes: '[Auto-ended: background tracking timeout]',
      updated_at: now,
    });
    console.log(`[LocationTracking] Zombie trip ${tripId} completed (${dominantActivity}, ${stats.totalDistance.toFixed(0)}m)`);
  }

  // Reset tracking state
  lastStationaryTime = null;
  resetGpsStabilization();
  TripDetectionService.resetState();
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
        // Use relaxed threshold before trip starts, strict during trip
        const activeTrip = await database.getActiveTrip();
        const threshold = activeTrip ? MIN_ACCURACY_METERS : TRIP_START_ACCURACY_METERS;
        const accuracy = location.coords.accuracy;
        const isAcceptable = accuracy === null || accuracy === undefined || accuracy <= threshold;
        if (isAcceptable) {
          try {
            await processSingleLocationUpdate(location);
          } catch (err) {
            console.error('[LocationTracking] Error processing foreground location:', err);
          }
        } else {
          console.log(
            `[LocationTracking] Foreground: skipped inaccurate location (${accuracy}m, threshold: ${threshold}m)`
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
      await logTrackingError(error);
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

    await logBackgroundTaskExecution(locations.length);

    // Log raw location data for debugging
    console.log('[LocationTracking] Raw locations received:', locations.map((loc, i) => ({
      index: i,
      lat: loc.coords.latitude.toFixed(6),
      lng: loc.coords.longitude.toFixed(6),
      accuracy: loc.coords.accuracy?.toFixed(0) || 'unknown',
      speed: loc.coords.speed?.toFixed(2) || 'unknown',
      timestamp: new Date(loc.timestamp).toISOString(),
    })));

    // Filter by accuracy - use relaxed threshold before trip starts, strict during trip
    await database.init();
    const activeTrip = await database.getActiveTrip();
    const accuracyThreshold = activeTrip ? MIN_ACCURACY_METERS : TRIP_START_ACCURACY_METERS;
    const accurateLocations = locations.filter(loc => {
      const accuracy = loc.coords.accuracy;
      if (accuracy === null || accuracy === undefined) return true;
      return accuracy <= accuracyThreshold;
    });
    const filteredCount = locations.length - accurateLocations.length;

    if (filteredCount > 0) {
      console.log(
        `[LocationTracking] Filtered ${filteredCount}/${locations.length} inaccurate locations (>${accuracyThreshold}m)`
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
      await logTrackingError(err);
    }
  }
});

// Log task registration success
console.log('[LocationTracking] ===== TASK REGISTERED =====');
console.log('[LocationTracking] Background task name:', LOCATION_TASK_NAME);

/**
 * Calculate speed from consecutive GPS points when device speed is unavailable.
 * iOS returns speed = -1 when it can't determine speed, so we fall back to
 * distance / time between consecutive points.
 */
function calculateSpeedFromPoints(lat: number, lng: number, timestamp: number): number {
  if (!previousLocationForSpeed) return 0;
  const timeDiffSeconds = (timestamp - previousLocationForSpeed.timestamp) / 1000;
  if (timeDiffSeconds <= 0 || timeDiffSeconds > 30) return 0;
  const distance = calculateDistance(
    { latitude: previousLocationForSpeed.latitude, longitude: previousLocationForSpeed.longitude },
    { latitude: lat, longitude: lng }
  );
  return distance / timeDiffSeconds;
}

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
    // iOS returns -1 for speed when unavailable; calculate from consecutive GPS points
    let currentSpeed: number;
    if (speed != null && speed > 0) {
      currentSpeed = speed;
    } else {
      currentSpeed = calculateSpeedFromPoints(latitude, longitude, timestamp);
      if (currentSpeed > 0) {
        console.log(
          `[LocationTracking] Calculated speed from GPS points: ${mpsToKmh(currentSpeed).toFixed(1)} km/h (device speed: ${speed})`
        );
      }
    }
    previousLocationForSpeed = { latitude, longitude, timestamp };

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

    // ===== GPS OUTLIER CHECK =====
    if (!isPointPhysicallyPlausible(latitude, longitude, timestamp)) {
      console.log('[LocationTracking] Skipping GPS outlier point');
      continue;
    }

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

    updateLastStoredLocation(latitude, longitude, timestamp);

    console.log(
      `[LocationTracking] ✓ Stored location (${classification.type}, ${classification.confidence}% confidence)`
    );

    // ===== UPDATE TRIP STATS =====
    const allLocations = await database.getLocationsByTrip(activeTrip.id);
    const stats = calculateTripStatistics(allLocations);
    let dominantActivity = getDominantActivityType(allLocations);

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

        // Post-hoc transit detection using pattern analysis
        const speeds = allLocations.map(loc => loc.speed || 0);
        const locationPoints = allLocations.map(loc => ({
          latitude: loc.latitude,
          longitude: loc.longitude,
          timestamp: loc.timestamp,
          speed: loc.speed ?? undefined,
        }));
        const patternClassification = ActivityClassifier.classifyWithPatterns(speeds, locationPoints);

        if (patternClassification.possibleTransit) {
          console.log('[LocationTracking] Transit pattern detected at trip end - marking as drive');
          dominantActivity = 'drive';
          await database.updateTrip(activeTrip.id, { type: 'drive', updated_at: timestamp });
        }

        // Validate minimum distances and types before completing
        const MIN_WALK_DISTANCE = 400;
        const MIN_RIDE_DISTANCE = 1000;
        let cancelReason: string | null = null;

        if (dominantActivity === 'walk' && stats.totalDistance < MIN_WALK_DISTANCE) {
          cancelReason = `Walk distance (${stats.totalDistance.toFixed(0)}m) below minimum (${MIN_WALK_DISTANCE}m)`;
        } else if (dominantActivity === 'cycle' && stats.totalDistance < MIN_RIDE_DISTANCE) {
          cancelReason = `Ride distance (${stats.totalDistance.toFixed(0)}m) below minimum (${MIN_RIDE_DISTANCE}m)`;
        } else if (dominantActivity === 'drive' || dominantActivity === 'run') {
          cancelReason = `Trip type '${dominantActivity}' not supported (only walk/cycle allowed)`;
        }

        if (cancelReason) {
          console.log(`[LocationTracking] Trip ${activeTrip.id} cancelled: ${cancelReason}`);
          await database.updateTrip(activeTrip.id, {
            status: 'cancelled',
            end_time: timestamp,
            notes: cancelReason,
            updated_at: timestamp,
          });
        } else {
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
      }

      // Reset tracking state for next trip
      lastStationaryTime = null;
      resetGpsStabilization();
      TripDetectionService.resetState();
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

    if (i > 0) {
      const prev = locations[i - 1];

      // Distance
      const dist = calculateDistance(
        { latitude: prev.latitude, longitude: prev.longitude },
        { latitude: loc.latitude, longitude: loc.longitude }
      );
      totalDistance += dist;

      // Max speed: use device speed but cross-check against calculated speed between points
      const deviceSpeedKmh = (loc.speed || 0) * 3.6;
      let pointMaxSpeed = deviceSpeedKmh;
      const segTimeDiff = (loc.timestamp - prev.timestamp) / 1000;
      if (segTimeDiff > 0) {
        const calculatedSpeedKmh = (dist / segTimeDiff) * 3.6;
        pointMaxSpeed = Math.min(deviceSpeedKmh, calculatedSpeedKmh * 1.5);
      }
      if (pointMaxSpeed > maxSpeed) {
        maxSpeed = pointMaxSpeed;
      }

      // Elevation gain
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
          `[LocationTracking] Transit override: avg speed ${calcAvgSpeedKmh.toFixed(1)} km/h but classified as walking`
        );
        return 'drive';
      }
    }
  }

  return mappedType;
}

// ===== PUBLIC SERVICE CLASS =====

export interface TrackingConfig {
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
      throw new Error(
        'Background location permission not granted. Please enable "Always" location access in Settings for reliable tracking.'
      );
    }

    // Initialize database
    await database.init();

    // Start background location updates
    // CRITICAL: Do NOT use deferredUpdatesInterval - iOS may never wake the app!
    try {
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
    } catch (error) {
      console.error('[LocationTracking] Failed to start location updates:', error);
      await logTrackingError(error);
      throw error; // Re-throw so TrackingContext can handle it
    }

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

// ===== PERSISTENT LOG READERS =====

export async function getTrackingErrorLog(): Promise<Array<{timestamp: string; platform: string; platformVersion: string; error: any}>> {
  try {
    const raw = await AsyncStorage.getItem(TRACKING_ERROR_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function getTrackingTaskLog(): Promise<Array<{timestamp: string; platform: string; locationCount: number}>> {
  try {
    const raw = await AsyncStorage.getItem(TRACKING_TASK_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function setTrackingPreference(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(TRACKING_PREFERENCE_KEY, JSON.stringify(enabled));
}

export async function getTrackingPreference(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(TRACKING_PREFERENCE_KEY);
    return raw ? JSON.parse(raw) === true : false;
  } catch {
    return false;
  }
}
