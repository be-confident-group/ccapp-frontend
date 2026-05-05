import { database } from '../../database';
import { tripAPI } from '../../api/trips';
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
    } as any);
    mockTripAPI.patchTrip.mockResolvedValue({} as any);

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
    } as any);
    mockTripAPI.patchTrip.mockResolvedValue({} as any);

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
    } as any);

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
    } as any);

    await syncService.patchTripFields('t4');

    expect(mockTripAPI.patchTrip).not.toHaveBeenCalled();
  });

  it('skips PATCH when trip not found', async () => {
    mockDatabase.getTrip.mockResolvedValue(null);

    await syncService.patchTripFields('missing');

    expect(mockTripAPI.patchTrip).not.toHaveBeenCalled();
  });
});
