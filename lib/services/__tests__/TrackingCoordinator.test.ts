import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
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

const mockLegacy = {
  startTracking: jest.fn().mockResolvedValue(undefined),
  stopTracking: jest.fn().mockResolvedValue(undefined),
  requestPermissions: jest.fn().mockResolvedValue({ foreground: 'granted', background: 'granted' }),
  checkPermissions: jest.fn().mockResolvedValue({ foreground: 'granted', background: 'granted' }),
};

jest.mock('../LocationTrackingService', () => ({
  LocationTrackingService: mockLegacy,
}));

jest.mock('../TripFinalizationPipeline', () => ({
  TripFinalizationPipeline: { finalize: jest.fn().mockResolvedValue(undefined) },
}));

import { TrackingCoordinator } from '../TrackingCoordinator';

beforeEach(() => {
  jest.clearAllMocks();
  // Reset singleton state so each test re-initializes with fresh AsyncStorage mock
  (TrackingCoordinator as any).initialized = false;
  (TrackingCoordinator as any).engine = 'native';
});

describe('TrackingCoordinator', () => {
  it('uses native engine by default (no stored key)', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    await TrackingCoordinator.start();
    expect(mockNative.start).toHaveBeenCalledTimes(1);
    expect(mockLegacy.startTracking).not.toHaveBeenCalled();
  });

  it('routes to legacy engine when @tracking_engine = legacy', async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) =>
      Promise.resolve(key === '@tracking_engine' ? 'legacy' : null)
    );
    await TrackingCoordinator.start();
    expect(mockLegacy.startTracking).toHaveBeenCalledTimes(1);
    expect(mockNative.start).not.toHaveBeenCalled();
  });

  it('forceStartTrip resolves with tripId on native', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    const result = await TrackingCoordinator.forceStartTrip();
    expect(result.tripId).toBe('trip_1');
  });

  it('forceStartTrip throws on legacy engine', async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) =>
      Promise.resolve(key === '@tracking_engine' ? 'legacy' : null)
    );
    await expect(TrackingCoordinator.forceStartTrip()).rejects.toThrow();
  });
});
