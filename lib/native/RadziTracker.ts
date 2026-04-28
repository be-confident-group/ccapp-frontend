import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

export type TrackingState = 'idle' | 'detecting' | 'recording' | 'cooldown' | 'ending';
export type Activity = 'stationary' | 'walking' | 'running' | 'cycling' | 'automotive' | 'unknown';
export type Confidence = 'low' | 'medium' | 'high';
export type AccuracyMode = 'best' | 'hundred' | 'low';

export interface TrackingStatus {
  state: TrackingState;
  activity: Activity;
  tripId: string | null;
  stagingId: string | null;
  gpsAccuracyMode: AccuracyMode | null;
  lastLocationTimestamp: number | null;
}

export interface PermissionStatus {
  location: 'granted' | 'denied' | 'whenInUse';
  motion: 'granted' | 'denied' | 'restricted';
}

export interface TrackerConfig {
  detectionSustainSeconds: number;
  detectingMinDurationSeconds: number;
  detectingMinDisplacementMeters: number;
  cooldownEnterSeconds: number;
  cooldownEndSeconds: number;
  imuSampleRateHz: number;
}

export interface TripStartedEvent {
  tripId: string;
  startTime: number;
  backfillStart: number;
}

export interface TripEndedEvent {
  tripId: string;
  endTime: number;
  recovered?: boolean;
}

export interface ActivityChangedEvent {
  activity: Activity;
  confidence: Confidence;
  timestamp: number;
}

export interface StateChangedEvent {
  state: TrackingState;
  previousState: TrackingState;
  timestamp: number;
}

export interface LocationStoredEvent {
  tripId: string;
  lat: number;
  lng: number;
  accuracy: number;
  speed: number;
  timestamp: number;
}

export interface NativeLogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error';
  message: string;
}

interface RadziTrackerNativeModule {
  start(): Promise<void>;
  stop(): Promise<void>;
  getStatus(): Promise<TrackingStatus>;
  forceStartTrip(): Promise<{ tripId: string }>;
  forceStopTrip(): Promise<void>;
  requestPermissions(): Promise<PermissionStatus>;
  checkPermissions(): Promise<PermissionStatus>;
  setConfig(config: Partial<TrackerConfig>): Promise<void>;
  getConfig(): Promise<TrackerConfig>;
  recoverStaleTrip(): Promise<{ recovered: string | null }>;
  notifyFinalizationComplete(): Promise<void>;
  getLogs(): Promise<NativeLogEntry[]>;
}

const Native = NativeModules.RadziTracker as RadziTrackerNativeModule | undefined;

if (!Native && Platform.OS === 'ios') {
  console.warn('[RadziTracker] Native module not linked. Did you rebuild after adding the module?');
}

const unavailable = () => Promise.reject(new Error('RadziTracker native module unavailable'));

export const RadziTrackerNative: RadziTrackerNativeModule = Native ?? {
  start: unavailable,
  stop: unavailable,
  getStatus: unavailable,
  forceStartTrip: unavailable,
  forceStopTrip: unavailable,
  requestPermissions: unavailable,
  checkPermissions: unavailable,
  setConfig: unavailable,
  getConfig: unavailable,
  recoverStaleTrip: unavailable,
  notifyFinalizationComplete: () => Promise.resolve(),
  getLogs: () => Promise.resolve([]),
};

const emitter = Native ? new NativeEventEmitter(NativeModules.RadziTracker) : null;

export const RadziTrackerEvents = {
  onTripStarted(cb: (e: TripStartedEvent) => void): () => void {
    const sub = emitter?.addListener('tripStarted', cb);
    return () => sub?.remove();
  },
  onTripEnded(cb: (e: TripEndedEvent) => void): () => void {
    const sub = emitter?.addListener('tripEnded', cb);
    return () => sub?.remove();
  },
  onActivityChanged(cb: (e: ActivityChangedEvent) => void): () => void {
    const sub = emitter?.addListener('activityChanged', cb);
    return () => sub?.remove();
  },
  onStateChanged(cb: (e: StateChangedEvent) => void): () => void {
    const sub = emitter?.addListener('stateChanged', cb);
    return () => sub?.remove();
  },
  onLocationStored(cb: (e: LocationStoredEvent) => void): () => void {
    const sub = emitter?.addListener('locationStored', cb);
    return () => sub?.remove();
  },
};
