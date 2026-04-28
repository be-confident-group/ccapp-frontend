import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, AppState } from 'react-native';
import {
  RadziTrackerNative,
  RadziTrackerEvents,
  type TrackingStatus,
  type PermissionStatus,
  type TripStartedEvent,
  type TripEndedEvent,
  type ActivityChangedEvent,
  type StateChangedEvent,
  type LocationStoredEvent,
} from '../native/RadziTracker';
import { LocationTrackingService } from './LocationTrackingService';
import { TripFinalizationPipeline } from './TripFinalizationPipeline';
import { database, type MotionSegment } from '../database';

const ENGINE_KEY = '@tracking_engine';
const MANUAL_ONLY_KEY = '@tracking_manual_only';

export type Engine = 'native' | 'legacy';

interface CoordinatorListeners {
  state: Set<(e: StateChangedEvent) => void>;
  activity: Set<(e: ActivityChangedEvent) => void>;
  tripStarted: Set<(e: TripStartedEvent) => void>;
  tripEnded: Set<(e: TripEndedEvent) => void>;
  locationStored: Set<(e: LocationStoredEvent) => void>;
}

class CoordinatorImpl {
  private engine: Engine = 'native';
  private manualOnly = false;
  private subs: Array<() => void> = [];
  private listeners: CoordinatorListeners = {
    state: new Set(),
    activity: new Set(),
    tripStarted: new Set(),
    tripEnded: new Set(),
    locationStored: new Set(),
  };
  private initPromise: Promise<void> | null = null;
  private permissionListeners = new Set<(p: PermissionStatus) => void>();
  private activeTripId: string | null = null;
  private pendingSegment: { tripId: string; activity: string; confidence: string; tStart: number } | null = null;

  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._doInit();
    return this.initPromise;
  }

  private async _doInit(): Promise<void> {
    const storedEngine = await AsyncStorage.getItem(ENGINE_KEY);
    this.engine = storedEngine === 'legacy' ? 'legacy' : 'native';
    const storedManual = await AsyncStorage.getItem(MANUAL_ONLY_KEY);
    this.manualOnly = storedManual === 'true';

    if (Platform.OS !== 'ios') {
      this.engine = 'legacy';
      console.log('[TrackingCoordinator] non-iOS platform — forcing legacy engine');
    }

    if (this.engine === 'native') {
      try {
        const { LocationTrackingService } = await import('./LocationTrackingService');
        await LocationTrackingService.stopTracking();
      } catch { /* ignore */ }
      this.attachNativeSubscriptions();
      try {
        const result = await RadziTrackerNative.recoverStaleTrip();
        if (result.recovered) {
          console.warn(`[TrackingCoordinator] Recovered stale trip ${result.recovered}`);
        }
      } catch (err) {
        console.error(`[TrackingCoordinator] recoverStaleTrip failed: ${String(err)}`);
      }
    }

    const appStateSub = AppState.addEventListener('change', async (state) => {
      if (state === 'active') {
        try {
          const perms = await this.checkPermissions();
          if (perms.location !== 'granted' || perms.motion !== 'granted') {
            console.warn(`[TrackingCoordinator] Permissions degraded: ${JSON.stringify(perms)}`);
            this.permissionListeners.forEach(cb => cb(perms));
          }
        } catch {}
      }
    });
    this.subs.push(() => appStateSub.remove());
  }

  async getEngine(): Promise<Engine> { return this.engine; }

  async setEngine(engine: Engine): Promise<void> {
    this.engine = engine;
    await AsyncStorage.setItem(ENGINE_KEY, engine);
  }

  async setManualOnly(value: boolean): Promise<void> {
    this.manualOnly = value;
    await AsyncStorage.setItem(MANUAL_ONLY_KEY, value ? 'true' : 'false');
  }

  async start(): Promise<void> {
    await this.init();
    if (this.engine === 'native' && !this.manualOnly) {
      await RadziTrackerNative.start();
    } else if (this.engine === 'legacy') {
      await LocationTrackingService.startTracking({});
    }
  }

  async stop(): Promise<void> {
    await this.init();
    if (this.engine === 'native') {
      await RadziTrackerNative.stop();
    } else {
      await LocationTrackingService.stopTracking();
    }
  }

  async forceStartTrip(): Promise<{ tripId: string }> {
    await this.init();
    if (this.engine === 'native') {
      return RadziTrackerNative.forceStartTrip();
    }
    throw new Error('forceStartTrip not supported on legacy engine');
  }

  async forceStopTrip(): Promise<void> {
    await this.init();
    if (this.engine === 'native') {
      return RadziTrackerNative.forceStopTrip();
    }
    throw new Error('forceStopTrip not supported on legacy engine');
  }

  async getStatus(): Promise<TrackingStatus | { engine: 'legacy' }> {
    await this.init();
    if (this.engine === 'native') {
      return RadziTrackerNative.getStatus();
    }
    return { engine: 'legacy' };
  }

  async requestPermissions(): Promise<PermissionStatus> {
    await this.init();
    if (this.engine === 'native') {
      return RadziTrackerNative.requestPermissions();
    }
    const result = await LocationTrackingService.requestPermissions();
    return {
      location: result.background === 'granted' ? 'granted' : (result.foreground === 'granted' ? 'whenInUse' : 'denied'),
      motion: 'granted',
    };
  }

  async checkPermissions(): Promise<PermissionStatus> {
    await this.init();
    if (this.engine === 'native') {
      return RadziTrackerNative.checkPermissions();
    }
    const result = await LocationTrackingService.checkPermissions();
    return {
      location: result.background === 'granted' ? 'granted' : (result.foreground === 'granted' ? 'whenInUse' : 'denied'),
      motion: 'granted',
    };
  }

  onStateChange(cb: (e: StateChangedEvent) => void): () => void {
    this.listeners.state.add(cb);
    return () => this.listeners.state.delete(cb);
  }
  onActivityChange(cb: (e: ActivityChangedEvent) => void): () => void {
    this.listeners.activity.add(cb);
    return () => this.listeners.activity.delete(cb);
  }
  onTripStarted(cb: (e: TripStartedEvent) => void): () => void {
    this.listeners.tripStarted.add(cb);
    return () => this.listeners.tripStarted.delete(cb);
  }
  onTripEnded(cb: (e: TripEndedEvent) => void): () => void {
    this.listeners.tripEnded.add(cb);
    return () => this.listeners.tripEnded.delete(cb);
  }
  onLocationStored(cb: (e: LocationStoredEvent) => void): () => void {
    this.listeners.locationStored.add(cb);
    return () => this.listeners.locationStored.delete(cb);
  }

  onPermissionDowngrade(cb: (p: PermissionStatus) => void): () => void {
    this.permissionListeners.add(cb);
    return () => this.permissionListeners.delete(cb);
  }

  private attachNativeSubscriptions(): void {
    this.detachAll();
    this.subs.push(RadziTrackerEvents.onStateChanged(e => this.listeners.state.forEach(cb => cb(e))));
    this.subs.push(RadziTrackerEvents.onActivityChanged(async e => {
      if (this.activeTripId) {
        if (this.pendingSegment) {
          try {
            await database.insertMotionSegment({
              trip_id: this.pendingSegment.tripId,
              t_start: this.pendingSegment.tStart,
              t_end: e.timestamp,
              activity: this.pendingSegment.activity as MotionSegment['activity'],
              confidence: this.pendingSegment.confidence as MotionSegment['confidence'],
              source: 'cmma',
            });
          } catch { /* non-fatal */ }
        }
        this.pendingSegment = { tripId: this.activeTripId, activity: e.activity, confidence: e.confidence, tStart: e.timestamp };
      }
      this.listeners.activity.forEach(cb => cb(e));
    }));

    this.subs.push(RadziTrackerEvents.onTripStarted(async e => {
      this.activeTripId = e.tripId;
      this.pendingSegment = null;
      const now = Date.now();
      try {
        await database.createTrip({
          id: e.tripId,
          user_id: '',
          type: 'walk',
          status: 'active',
          is_manual: 0,
          start_time: e.startTime,
          created_at: now,
          updated_at: now,
        });
      } catch {
        // Trip may already exist (e.g. app restarted mid-trip) — not fatal
      }
      try {
        await database.updateTrip(e.tripId, { engine: 'native', backfill_start: e.backfillStart });
      } catch {
        // Non-fatal
      }
      this.listeners.tripStarted.forEach(cb => cb(e));
    }));

    this.subs.push(RadziTrackerEvents.onLocationStored(async e => {
      try {
        await database.addLocation({
          trip_id: e.tripId,
          latitude: e.lat,
          longitude: e.lng,
          altitude: null,
          accuracy: e.accuracy,
          speed: e.speed,
          heading: null,
          timestamp: e.timestamp,
          activity_type: null,
          activity_confidence: null,
          synced: 0,
        });
      } catch {
        // Non-fatal — finalization falls back to 0 distance
      }
      this.listeners.locationStored.forEach(cb => cb(e));
    }));

    this.subs.push(RadziTrackerEvents.onTripEnded(async e => {
      // Close any open activity segment
      if (this.pendingSegment) {
        try {
          await database.insertMotionSegment({
            trip_id: this.pendingSegment.tripId,
            t_start: this.pendingSegment.tStart,
            t_end: e.endTime,
            activity: this.pendingSegment.activity as MotionSegment['activity'],
            confidence: this.pendingSegment.confidence as MotionSegment['confidence'],
            source: 'cmma',
          });
        } catch { /* non-fatal */ }
        this.pendingSegment = null;
      }
      this.activeTripId = null;
      try {
        await database.updateTrip(e.tripId, {
          status: 'completed',
          end_time: e.endTime,
          updated_at: Date.now(),
        });
      } catch {
        // Non-fatal — trip may not exist in JS DB if tripStarted was missed
      }
      try {
        await TripFinalizationPipeline.finalize(e.tripId);
      } catch (err) {
        console.error(`[TrackingCoordinator] Finalization failed for ${e.tripId}: ${String(err)}`);
      }
      this.listeners.tripEnded.forEach(cb => cb(e));
    }));
  }

  private detachAll(): void {
    this.subs.forEach(unsub => unsub());
    this.subs = [];
    this.activeTripId = null;
    this.pendingSegment = null;
  }
}

export const TrackingCoordinator = new CoordinatorImpl();
