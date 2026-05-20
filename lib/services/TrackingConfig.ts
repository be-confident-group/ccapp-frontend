/**
 * Remote tracking configuration service.
 *
 * Fetches tunable thresholds from GET /api/tracking-config/ and caches them
 * locally so the app works offline. All numeric knobs in the tracking pipeline
 * (false-start gate, speed ceilings, GPS accuracy threshold, etc.) are driven
 * by this config so they can be tuned in production without an app release.
 *
 * Usage:
 *   // Imperative (in services / Swift bridge calls):
 *   const config = await getTrackingConfig();
 *
 *   // React (in components):
 *   const config = useTrackingConfig();
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { apiClient } from '../api/client';
import { useEffect, useState } from 'react';

const CACHE_KEY = 'tracking-config:v1';
const STALE_AFTER_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface TrackingConfig {
  // Detecting-phase gates
  detectingMinDurationSec: number;
  detectingMinDisplacementM: number;
  falseStartGpsDisplacementM: number;
  detectingMinPedometerSteps: number;

  // GPS quality — strict during detecting (cold-start fixes corrupt displacement),
  // relaxed during recording (urban-canyon walks sit at 20–50 m and would otherwise be starved).
  detectingAccuracyThresholdM: number;
  recordingAccuracyThresholdM: number;

  // Trip lifecycle
  cooldownEnterSec: number;
  cooldownEndSec: number;

  // Validation ceilings (mirrored to FE for pre-flight checks; backend is authoritative)
  maxSpeedWalkKmh: number;
  maxSpeedRunKmh: number;
  maxSpeedCycleKmh: number;
  minDistanceWalkKm: number;
  minDistanceCycleKm: number;

  // 0 m rejection
  minTripDistanceM: number;
  minTripLocationCount: number;
  minTripPedometerSteps: number;

  // CMMA confidence
  allowLowConfidenceWalking: boolean;
  multiWindowVoteSec: number;

  configVersion: string;
  fetchedAt: number; // unix ms, local only — not from server
}

export const DEFAULT_TRACKING_CONFIG: TrackingConfig = {
  detectingMinDurationSec: 60,
  detectingMinDisplacementM: 30,
  falseStartGpsDisplacementM: 15,
  detectingMinPedometerSteps: 40,
  detectingAccuracyThresholdM: 20,
  recordingAccuracyThresholdM: 65,
  cooldownEnterSec: 30,
  cooldownEndSec: 180,
  maxSpeedWalkKmh: 12,
  maxSpeedRunKmh: 30,
  maxSpeedCycleKmh: 60,
  minDistanceWalkKm: 0.4,
  minDistanceCycleKm: 1.0,
  minTripDistanceM: 50,
  minTripLocationCount: 3,
  minTripPedometerSteps: 40,
  allowLowConfidenceWalking: true,
  multiWindowVoteSec: 20,
  configVersion: 'default',
  fetchedAt: 0,
};

// In-memory copy so synchronous reads are possible after first load.
let _cached: TrackingConfig = { ...DEFAULT_TRACKING_CONFIG };
let _listeners: Array<(config: TrackingConfig) => void> = [];

function notify(config: TrackingConfig) {
  _cached = config;
  _listeners.forEach(fn => fn(config));
}

/** Map snake_case server response keys to camelCase TrackingConfig fields. */
function fromServerResponse(data: Record<string, unknown>): TrackingConfig {
  return {
    detectingMinDurationSec:    (data['detecting_min_duration_sec']     as number) ?? DEFAULT_TRACKING_CONFIG.detectingMinDurationSec,
    detectingMinDisplacementM:  (data['detecting_min_displacement_m']   as number) ?? DEFAULT_TRACKING_CONFIG.detectingMinDisplacementM,
    falseStartGpsDisplacementM: (data['false_start_gps_displacement_m'] as number) ?? DEFAULT_TRACKING_CONFIG.falseStartGpsDisplacementM,
    detectingMinPedometerSteps: (data['detecting_min_pedometer_steps']  as number) ?? DEFAULT_TRACKING_CONFIG.detectingMinPedometerSteps,
    // Back-compat: if the server still sends the legacy single key, apply it to detecting only.
    detectingAccuracyThresholdM: (data['detecting_accuracy_threshold_m'] as number)
      ?? (data['location_accuracy_threshold_m'] as number)
      ?? DEFAULT_TRACKING_CONFIG.detectingAccuracyThresholdM,
    recordingAccuracyThresholdM: (data['recording_accuracy_threshold_m'] as number)
      ?? DEFAULT_TRACKING_CONFIG.recordingAccuracyThresholdM,
    cooldownEnterSec:           (data['cooldown_enter_sec']             as number) ?? DEFAULT_TRACKING_CONFIG.cooldownEnterSec,
    cooldownEndSec:             (data['cooldown_end_sec']               as number) ?? DEFAULT_TRACKING_CONFIG.cooldownEndSec,
    maxSpeedWalkKmh:            (data['max_speed_walk_kmh']             as number) ?? DEFAULT_TRACKING_CONFIG.maxSpeedWalkKmh,
    maxSpeedRunKmh:             (data['max_speed_run_kmh']              as number) ?? DEFAULT_TRACKING_CONFIG.maxSpeedRunKmh,
    maxSpeedCycleKmh:           (data['max_speed_cycle_kmh']            as number) ?? DEFAULT_TRACKING_CONFIG.maxSpeedCycleKmh,
    minDistanceWalkKm:          (data['min_distance_walk_km']           as number) ?? DEFAULT_TRACKING_CONFIG.minDistanceWalkKm,
    minDistanceCycleKm:         (data['min_distance_cycle_km']          as number) ?? DEFAULT_TRACKING_CONFIG.minDistanceCycleKm,
    minTripDistanceM:           (data['min_trip_distance_m']            as number) ?? DEFAULT_TRACKING_CONFIG.minTripDistanceM,
    minTripLocationCount:       (data['min_trip_location_count']        as number) ?? DEFAULT_TRACKING_CONFIG.minTripLocationCount,
    minTripPedometerSteps:      (data['min_trip_pedometer_steps']       as number) ?? DEFAULT_TRACKING_CONFIG.minTripPedometerSteps,
    allowLowConfidenceWalking:  (data['allow_low_confidence_walking']   as boolean) ?? DEFAULT_TRACKING_CONFIG.allowLowConfidenceWalking,
    multiWindowVoteSec:         (data['multi_window_vote_sec']          as number) ?? DEFAULT_TRACKING_CONFIG.multiWindowVoteSec,
    configVersion:              (data['config_version']                 as string)  ?? DEFAULT_TRACKING_CONFIG.configVersion,
    fetchedAt: Date.now(),
  };
}

/** Convert TrackingConfig to the shape RadziTracker.setConfig() expects. */
export function toNativeConfig(config: TrackingConfig): Record<string, unknown> {
  return {
    detectingMinDurationSeconds:    config.detectingMinDurationSec,
    detectingMinDisplacementMeters: config.detectingMinDisplacementM,
    falseStartGpsDisplacementMeters: config.falseStartGpsDisplacementM,
    detectingMinPedometerSteps:     config.detectingMinPedometerSteps,
    detectingAccuracyThresholdM:    config.detectingAccuracyThresholdM,
    recordingAccuracyThresholdM:    config.recordingAccuracyThresholdM,
    cooldownEnterSeconds:           config.cooldownEnterSec,
    cooldownEndSeconds:             config.cooldownEndSec,
    multiWindowVoteSec:             config.multiWindowVoteSec,
    allowLowConfidenceWalking:      config.allowLowConfidenceWalking,
  };
}

async function loadFromCache(): Promise<TrackingConfig | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TrackingConfig;
  } catch {
    return null;
  }
}

async function saveToCache(config: TrackingConfig): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(config));
  } catch {
    // Non-fatal — in-memory copy still works.
  }
}

let _fetchInFlight = false;

async function fetchFromServer(): Promise<TrackingConfig | null> {
  if (_fetchInFlight) return null;
  _fetchInFlight = true;
  try {
    const response = await apiClient.get<Record<string, unknown>>('/api/tracking-config/');
    const config = fromServerResponse(response);
    await saveToCache(config);
    return config;
  } catch (err) {
    console.warn('[TrackingConfig] fetch failed:', err);
    return null;
  } finally {
    _fetchInFlight = false;
  }
}

/**
 * Initialises the config service. Call once at app startup (e.g. in _layout.tsx).
 * Loads the cache immediately then fetches fresh data in the background.
 * Also wires an AppState listener to refetch when the app returns to foreground
 * after more than 24 h.
 */
export async function initTrackingConfig(): Promise<void> {
  // Load cache first so synchronous readers have something sensible.
  const cached = await loadFromCache();
  if (cached) notify(cached);

  // Fetch fresh from server.
  const fresh = await fetchFromServer();
  if (fresh) {
    notify(fresh);
    await pushConfigToNative(fresh);
  }

  // Refetch on foreground if stale.
  AppState.addEventListener('change', async (nextState) => {
    if (nextState !== 'active') return;
    const now = Date.now();
    if (now - _cached.fetchedAt < STALE_AFTER_MS) return;
    const updated = await fetchFromServer();
    if (updated) {
      notify(updated);
      await pushConfigToNative(updated);
    }
  });
}

/** Push the given config to the native TripStateMachine via the bridge. */
async function pushConfigToNative(config: TrackingConfig): Promise<void> {
  try {
    const { RadziTrackerNative } = await import('../native/RadziTracker');
    await RadziTrackerNative.setConfig(toNativeConfig(config) as any);
  } catch (err) {
    console.warn('[TrackingConfig] setConfig native bridge error:', err);
  }
}

/** Imperative accessor — returns the in-memory copy synchronously. */
export function getTrackingConfig(): TrackingConfig {
  return _cached;
}

/** Subscribe to config changes (returns unsubscribe function). */
export function subscribeTrackingConfig(fn: (config: TrackingConfig) => void): () => void {
  _listeners.push(fn);
  return () => {
    _listeners = _listeners.filter(l => l !== fn);
  };
}

/** React hook — re-renders when config changes. */
export function useTrackingConfig(): TrackingConfig {
  const [config, setConfig] = useState<TrackingConfig>(_cached);

  useEffect(() => {
    // Sync to latest in case it changed between render and effect.
    setConfig(_cached);
    return subscribeTrackingConfig(setConfig);
  }, []);

  return config;
}
