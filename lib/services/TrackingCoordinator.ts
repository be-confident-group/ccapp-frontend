import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
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
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    const storedEngine = await AsyncStorage.getItem(ENGINE_KEY);
    this.engine = storedEngine === 'legacy' ? 'legacy' : 'native';
    const storedManual = await AsyncStorage.getItem(MANUAL_ONLY_KEY);
    this.manualOnly = storedManual === 'true';

    if (Platform.OS !== 'ios') {
      this.engine = 'legacy';
      console.log('[TrackingCoordinator] non-iOS platform — forcing legacy engine');
    }

    if (this.engine === 'native') {
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
  }

  async getEngine(): Promise<Engine> { return this.engine; }

  async setEngine(engine: Engine): Promise<void> {
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

  private attachNativeSubscriptions(): void {
    this.detachAll();
    this.subs.push(RadziTrackerEvents.onStateChanged(e => this.listeners.state.forEach(cb => cb(e))));
    this.subs.push(RadziTrackerEvents.onActivityChanged(e => this.listeners.activity.forEach(cb => cb(e))));
    this.subs.push(RadziTrackerEvents.onTripStarted(e => this.listeners.tripStarted.forEach(cb => cb(e))));
    this.subs.push(RadziTrackerEvents.onLocationStored(e => this.listeners.locationStored.forEach(cb => cb(e))));
    this.subs.push(RadziTrackerEvents.onTripEnded(async e => {
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
  }
}

export const TrackingCoordinator = new CoordinatorImpl();
