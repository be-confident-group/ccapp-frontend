import { database } from '../../database';
import { tripAPI } from '../../api/trips';
import type { ApiTrip } from '../../api/trips';
import type { Trip } from '../../database/db';
import { syncService } from '../SyncService';

// Mock dependencies
jest.mock('../../database', () => ({
  database: {
    getTrip: jest.fn(),
    updateTrip: jest.fn().mockResolvedValue(undefined),
    getAllTrips: jest.fn().mockResolvedValue([]),
    getLocationsByTrip: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../../api/trips', () => ({
  tripAPI: {
    patchTrip: jest.fn(),
    createTrip: jest.fn(),
    syncTrips: jest.fn(),
  },
  transformTripForApi: jest.fn(),
}));

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn().mockResolvedValue({ isConnected: true, isInternetReachable: true }),
}));

jest.mock('../TripValidationService', () => ({
  TripValidationService: { validateTrip: jest.fn().mockReturnValue({ isValid: true, reasons: [] }) },
}));

jest.mock('../TrackingConfig', () => ({
  getTrackingConfig: () => ({
    minTripDistanceM: 50,
    minTripLocationCount: 3,
  }),
}));

const mockDatabase = database as jest.Mocked<typeof database>;
const mockTripAPI = tripAPI as jest.Mocked<typeof tripAPI>;

describe('SyncService.patchTripFields', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('PATCHes user_note when user_note_dirty=1 and clears flags', async () => {
    mockDatabase.getTrip.mockResolvedValue({
      id: 't1',
      backend_id: 99,
      user_note: 'great ride',
      user_note_dirty: 1,
      type_dirty: 0,
      type: 'cycle',
      synced: 1,
    } as unknown as Trip);
    mockTripAPI.patchTrip.mockResolvedValue({ id: 99 } as ApiTrip);

    await syncService.patchTripFields('t1');

    expect(mockTripAPI.patchTrip).toHaveBeenCalledWith(99, { user_note: 'great ride' });
    expect(mockDatabase.updateTrip).toHaveBeenCalledWith('t1', { user_note_dirty: 0, type_dirty: 0 });
  });

  it('PATCHes type when type_dirty=1 and clears flags', async () => {
    mockDatabase.getTrip.mockResolvedValue({
      id: 't2',
      backend_id: 42,
      user_note: null,
      user_note_dirty: 0,
      type_dirty: 1,
      type: 'walk',
      synced: 1,
    } as unknown as Trip);
    mockTripAPI.patchTrip.mockResolvedValue({ id: 42 } as ApiTrip);

    await syncService.patchTripFields('t2');

    expect(mockTripAPI.patchTrip).toHaveBeenCalledWith(42, { type: 'walk' });
    expect(mockDatabase.updateTrip).toHaveBeenCalledWith('t2', { user_note_dirty: 0, type_dirty: 0 });
  });

  it('skips PATCH when no dirty flags', async () => {
    mockDatabase.getTrip.mockResolvedValue({
      id: 't3',
      backend_id: 7,
      user_note_dirty: 0,
      type_dirty: 0,
      type: 'walk',
      synced: 1,
    } as unknown as Trip);

    await syncService.patchTripFields('t3');

    expect(mockTripAPI.patchTrip).not.toHaveBeenCalled();
  });

  it('skips PATCH when no backend_id', async () => {
    mockDatabase.getTrip.mockResolvedValue({
      id: 't4',
      backend_id: null,
      user_note_dirty: 1,
      user_note: 'test',
      synced: 0,
    } as unknown as Trip);

    await syncService.patchTripFields('t4');

    expect(mockTripAPI.patchTrip).not.toHaveBeenCalled();
  });

  it('skips PATCH when trip not found', async () => {
    mockDatabase.getTrip.mockResolvedValue(null);

    await syncService.patchTripFields('missing');

    expect(mockTripAPI.patchTrip).not.toHaveBeenCalled();
  });
});

describe('SyncService.syncDirtyTrips', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('patches each dirty synced trip', async () => {
    const NetInfo = require('@react-native-community/netinfo');
    NetInfo.fetch.mockResolvedValue({ isConnected: true, isInternetReachable: true });

    mockDatabase.getAllTrips.mockResolvedValue([
      { id: 'a', synced: 1, backend_id: 1, user_note_dirty: 1, user_note: 'note', type_dirty: 0, type: 'walk' } as unknown as Trip,
      { id: 'b', synced: 1, backend_id: 2, user_note_dirty: 0, type_dirty: 1, type: 'cycle', user_note: null } as unknown as Trip,
    ]);
    mockDatabase.getTrip
      .mockResolvedValueOnce({ id: 'a', synced: 1, backend_id: 1, user_note_dirty: 1, user_note: 'note', type_dirty: 0, type: 'walk' } as unknown as Trip)
      .mockResolvedValueOnce({ id: 'b', synced: 1, backend_id: 2, user_note_dirty: 0, type_dirty: 1, type: 'cycle', user_note: null } as unknown as Trip);
    mockTripAPI.patchTrip.mockResolvedValue({ id: 99 } as unknown as ApiTrip);

    await syncService.syncDirtyTrips();

    expect(mockTripAPI.patchTrip).toHaveBeenCalledTimes(2);
  });

  it('skips when offline', async () => {
    const NetInfo = require('@react-native-community/netinfo');
    NetInfo.fetch.mockResolvedValue({ isConnected: false, isInternetReachable: false });

    await syncService.syncDirtyTrips();

    expect(mockTripAPI.patchTrip).not.toHaveBeenCalled();
  });

  it('continues patching other trips when one fails', async () => {
    const NetInfo = require('@react-native-community/netinfo');
    NetInfo.fetch.mockResolvedValue({ isConnected: true, isInternetReachable: true });

    mockDatabase.getAllTrips.mockResolvedValue([
      { id: 'a', synced: 1, backend_id: 1, user_note_dirty: 1, user_note: 'note', type_dirty: 0, type: 'walk' } as unknown as Trip,
      { id: 'b', synced: 1, backend_id: 2, user_note_dirty: 1, user_note: 'note2', type_dirty: 0, type: 'cycle' } as unknown as Trip,
    ]);
    mockDatabase.getTrip
      .mockResolvedValueOnce({ id: 'a', synced: 1, backend_id: 1, user_note_dirty: 1, user_note: 'note', type_dirty: 0, type: 'walk' } as unknown as Trip)
      .mockResolvedValueOnce({ id: 'b', synced: 1, backend_id: 2, user_note_dirty: 1, user_note: 'note2', type_dirty: 0, type: 'cycle' } as unknown as Trip);
    mockTripAPI.patchTrip
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ id: 99 } as unknown as ApiTrip);

    await syncService.syncDirtyTrips();

    expect(mockTripAPI.patchTrip).toHaveBeenCalledTimes(2);
    expect(mockDatabase.updateTrip).toHaveBeenCalledTimes(1);
  });
});

describe('SyncService.cleanupInvalidTrips', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does NOT cancel a completed walk below the 400m per-type minimum (lets backend decide)', async () => {
    mockDatabase.getAllTrips.mockResolvedValue([
      { id: 'short-walk', distance: 250, type: 'walk', status: 'completed', synced: 0 } as unknown as Trip,
    ]);
    mockDatabase.getLocationsByTrip.mockResolvedValue(
      Array.from({ length: 20 }, (_, i) => ({ latitude: 51 + i * 0.001, longitude: 0 })) as any
    );

    await syncService.cleanupInvalidTrips();

    expect(mockDatabase.updateTrip).not.toHaveBeenCalled();
  });

  it('does NOT cancel a looping walk that trips GPS-drift heuristics', async () => {
    // 600m walk that returns near its start (looks "circular") — valid real walk
    mockDatabase.getAllTrips.mockResolvedValue([
      { id: 'loop-walk', distance: 600, type: 'walk', status: 'completed', synced: 0 } as unknown as Trip,
    ]);
    mockDatabase.getLocationsByTrip.mockResolvedValue(
      Array.from({ length: 30 }, (_, i) => ({
        latitude: 51 + Math.sin((i / 30) * 2 * Math.PI) * 0.001,
        longitude: Math.cos((i / 30) * 2 * Math.PI) * 0.001,
      })) as any
    );

    await syncService.cleanupInvalidTrips();

    expect(mockDatabase.updateTrip).not.toHaveBeenCalled();
  });

  it('cancels a genuinely GPS-starved trip (below junk floor on BOTH distance and point count)', async () => {
    mockDatabase.getAllTrips.mockResolvedValue([
      { id: 'junk', distance: 10, type: 'walk', status: 'completed', synced: 0 } as unknown as Trip,
    ]);
    // Only 2 points — below minTripLocationCount (3)
    mockDatabase.getLocationsByTrip.mockResolvedValue([
      { latitude: 51, longitude: 0 },
      { latitude: 51, longitude: 0 },
    ] as any);

    await syncService.cleanupInvalidTrips();

    expect(mockDatabase.updateTrip).toHaveBeenCalledWith('junk', expect.objectContaining({ status: 'cancelled' }));
  });

  it('does NOT cancel a starved trip if it has enough distance (e.g. manual trip with sparse route)', async () => {
    mockDatabase.getAllTrips.mockResolvedValue([
      { id: 'sparse-but-long', distance: 800, type: 'walk', status: 'completed', synced: 0 } as unknown as Trip,
    ]);
    mockDatabase.getLocationsByTrip.mockResolvedValue([
      { latitude: 51, longitude: 0 },
      { latitude: 51.01, longitude: 0 },
    ] as any);

    await syncService.cleanupInvalidTrips();

    expect(mockDatabase.updateTrip).not.toHaveBeenCalled();
  });
});
