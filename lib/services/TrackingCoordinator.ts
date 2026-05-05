import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
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
import { TripFinalizationPipeline } from './TripFinalizationPipeline';

const MANUAL_ONLY_KEY = '@tracking_manual_only';

export type Engine = 'native';

interface CoordinatorListeners {
  state: Set<(e: StateChangedEvent) => void>;
  activity: Set<(e: ActivityChangedEvent) => void>;
  tripStarted: Set<(e: TripStartedEvent) => void>;
  tripEnded: Set<(e: TripEndedEvent) => void>;
  locationStored: Set<(e: LocationStoredEvent) => void>;
}

class CoordinatorImpl {
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
  private activeTripNotificationId: string | null = null;


  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._doInit();
    return this.initPromise;
  }

  private async _doInit(): Promise<void> {
    const storedManual = await AsyncStorage.getItem(MANUAL_ONLY_KEY);
    this.manualOnly = storedManual === 'true';

    this.attachNativeSubscriptions();
    try {
      const result = await RadziTrackerNative.recoverStaleTrip();
      if (result.recovered) {
        console.warn(`[TrackingCoordinator] Recovered stale trip ${result.recovered}`);
      }
    } catch (err) {
      console.error(`[TrackingCoordinator] recoverStaleTrip failed: ${String(err)}`);
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

  async getEngine(): Promise<Engine> { return 'native'; }

  async setManualOnly(value: boolean): Promise<void> {
    this.manualOnly = value;
    await AsyncStorage.setItem(MANUAL_ONLY_KEY, value ? 'true' : 'false');
  }

  async start(): Promise<void> {
    await this.init();
    if (!this.manualOnly) {
      await RadziTrackerNative.start();
    }
  }

  async stop(): Promise<void> {
    await this.init();
    await RadziTrackerNative.stop();
  }

  async forceStartTrip(): Promise<{ tripId: string }> {
    await this.init();
    return RadziTrackerNative.forceStartTrip();
  }

  async forceStopTrip(): Promise<void> {
    await this.init();
    return RadziTrackerNative.forceStopTrip();
  }

  async getStatus(): Promise<TrackingStatus> {
    await this.init();
    return RadziTrackerNative.getStatus();
  }

  async requestPermissions(): Promise<PermissionStatus> {
    await this.init();
    return RadziTrackerNative.requestPermissions();
  }

  async checkPermissions(): Promise<PermissionStatus> {
    await this.init();
    return RadziTrackerNative.checkPermissions();
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
      // Forward to listeners only — native GRDB already writes motion segments.
      this.listeners.activity.forEach(cb => cb(e));
    }));

    this.subs.push(RadziTrackerEvents.onTripStarted(async e => {
      this.activeTripId = e.tripId;
      // Show persistent notification so user knows a trip is being recorded.
      // Native GRDB already created the trip row — no JS DB write needed.
      try {
        const { status } = await Notifications.getPermissionsAsync();
        if (status === 'granted') {
          this.activeTripNotificationId = `trip-recording-${e.tripId}`;
          await Notifications.scheduleNotificationAsync({
            identifier: this.activeTripNotificationId,
            content: {
              title: 'Trip recording in progress',
              body: 'Your activity is being tracked',
            },
            trigger: null,
          });
        }
      } catch {
        // Never let notification errors interrupt tracking
      }
      this.listeners.tripStarted.forEach(cb => cb(e));
    }));

    // locationStored: native GRDB already wrote the location — forwarding the
    // event to listeners is enough.  DO NOT also insert via database.addLocation()
    // because that creates duplicate rows in the same SQLite file and corrupts
    // the distance calculation during finalization.
    this.subs.push(RadziTrackerEvents.onLocationStored(async e => {
      this.listeners.locationStored.forEach(cb => cb(e));
    }));

    this.subs.push(RadziTrackerEvents.onTripEnded(async e => {
      this.activeTripId = null;
      // Dismiss trip-recording notification
      try {
        if (this.activeTripNotificationId) {
          await Notifications.dismissNotificationAsync(this.activeTripNotificationId);
          this.activeTripNotificationId = null;
        }
      } catch {
        // Non-fatal
      }
      // Native GRDB already marked the trip completed.  Run the JS finalization
      // pipeline (XGBoost classify, validate, sync) which reads the native-written data.
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
    this.activeTripNotificationId = null;
  }
}

export const TrackingCoordinator = new CoordinatorImpl();
