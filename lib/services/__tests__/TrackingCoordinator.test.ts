import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

jest.mock('react-native', () => ({
  AppState: { addEventListener: jest.fn().mockReturnValue({ remove: jest.fn() }) },
}));

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'denied' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'denied' }),
  scheduleNotificationAsync: jest.fn().mockResolvedValue(undefined),
  dismissNotificationAsync: jest.fn().mockResolvedValue(undefined),
}));

const mockNative = {
  start: jest.fn().mockResolvedValue(undefined),
  stop: jest.fn().mockResolvedValue(undefined),
  getStatus: jest.fn().mockResolvedValue({ state: 'idle', activity: 'unknown', tripId: null, stagingId: null, gpsAccuracyMode: 'off', lastLocationTimestamp: null }),
  forceStartTrip: jest.fn().mockResolvedValue({ tripId: 'trip_1' }),
  forceStopTrip: jest.fn().mockResolvedValue(undefined),
  requestPermissions: jest.fn().mockResolvedValue({ location: 'granted', motion: 'granted' }),
  checkPermissions: jest.fn().mockResolvedValue({ location: 'granted', motion: 'granted' }),
  setConfig: jest.fn().mockResolvedValue(undefined),
  getConfig: jest.fn().mockResolvedValue({}),
  recoverStaleTrip: jest.fn().mockResolvedValue({ recovered: null }),
};

const mockEvents = {
  onStateChanged: jest.fn().mockReturnValue(() => {}),
  onActivityChanged: jest.fn().mockReturnValue(() => {}),
  onTripStarted: jest.fn().mockReturnValue(() => {}),
  onTripEnded: jest.fn().mockReturnValue(() => {}),
  onLocationStored: jest.fn().mockReturnValue(() => {}),
};

jest.mock('../../native/RadziTracker', () => ({
  RadziTrackerNative: mockNative,
  RadziTrackerEvents: mockEvents,
}));

jest.mock('../TripFinalizationPipeline', () => ({
  TripFinalizationPipeline: { finalize: jest.fn().mockResolvedValue(undefined) },
}));

import { TrackingCoordinator } from '../TrackingCoordinator';

beforeEach(() => {
  jest.clearAllMocks();
  // Reset singleton state so each test re-initializes with fresh mocks
  (TrackingCoordinator as any).initPromise = null;
  (TrackingCoordinator as any).manualOnly = false;
});

describe('TrackingCoordinator', () => {
  it('uses native engine by default (no stored key)', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    await TrackingCoordinator.start();
    expect(mockNative.start).toHaveBeenCalledTimes(1);
  });

  it('getEngine always returns native', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    const engine = await TrackingCoordinator.getEngine();
    expect(engine).toBe('native');
  });

  it('forceStartTrip resolves with tripId', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    const result = await TrackingCoordinator.forceStartTrip();
    expect(result.tripId).toBe('trip_1');
  });

  it('stop delegates to native', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    await TrackingCoordinator.stop();
    expect(mockNative.stop).toHaveBeenCalledTimes(1);
  });

  it('does not call start when manualOnly is set', async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) =>
      Promise.resolve(key === '@tracking_manual_only' ? 'true' : null)
    );
    await TrackingCoordinator.start();
    expect(mockNative.start).not.toHaveBeenCalled();
  });
});
