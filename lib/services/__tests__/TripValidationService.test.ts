import { TripValidationService } from '../TripValidationService';
import { database } from '../../database';
import type { Trip } from '../../database/db';

jest.mock('../../database', () => ({
  database: {
    getTrip: jest.fn(),
    getTripById: jest.fn(),
    getLocationsByTrip: jest.fn().mockResolvedValue([]),
    updateTrip: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../TrackingConfig', () => ({
  getTrackingConfig: () => ({
    minTripDistanceM: 50,
    minTripLocationCount: 3,
  }),
}));

const mockDb = database as jest.Mocked<typeof database>;

const makeTrip = (overrides: Partial<Trip>): Trip => ({
  id: 'trip-1',
  user_id: 'u1',
  type: 'walk',
  status: 'completed',
  distance: 600,
  duration: 720,
  max_speed: 5,
  avg_speed: 3,
  is_manual: 0,
  synced: 0,
  route_data: null,
  notes: null,
  start_time: Date.now() - 720000,
  end_time: Date.now(),
  created_at: Date.now(),
  updated_at: Date.now(),
  elevation_gain: 0,
  calories: 0,
  co2_saved: 0,
  classification_method: null,
  ml_activity_type: null,
  ml_confidence: null,
  backend_id: null,
  user_note: null,
  user_note_dirty: 0,
  type_dirty: 0,
  visible: 1,
  ...overrides,
} as unknown as Trip);

describe('TripValidationService.validateAndFinalizeTrip', () => {
  const endTime = Date.now();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps a real walk that returns near its start (out-and-back / loop)', async () => {
    // 600m walk that peaks ~120m from start then returns — previously failed minMaxDistanceFromStart (150m)
    const trip = makeTrip({ distance: 600, type: 'walk', max_speed: 5 });
    mockDb.getTrip.mockResolvedValue(trip);
    const locations = Array.from({ length: 30 }, (_, i) => ({
      latitude: 51 + Math.sin((i / 30) * Math.PI) * 0.001,
      longitude: Math.cos((i / 30) * Math.PI) * 0.001,
      timestamp: Date.now() - (30 - i) * 24000,
      accuracy: 15,
    }));
    mockDb.getLocationsByTrip.mockResolvedValue(locations as any);

    const result = await TripValidationService.validateAndFinalizeTrip('trip-1', endTime);

    expect(result.isValid).toBe(true);
    expect(mockDb.updateTrip).toHaveBeenCalledWith('trip-1', expect.objectContaining({ status: 'completed' }));
  });

  it('keeps a short-but-real walk below the 400m per-type minimum', async () => {
    const trip = makeTrip({ distance: 250, type: 'walk', max_speed: 4 });
    mockDb.getTrip.mockResolvedValue(trip);
    const locations = Array.from({ length: 20 }, (_, i) => ({
      latitude: 51 + i * 0.0002,
      longitude: 0,
      timestamp: Date.now() - (20 - i) * 30000,
      accuracy: 10,
    }));
    mockDb.getLocationsByTrip.mockResolvedValue(locations as any);

    const result = await TripValidationService.validateAndFinalizeTrip('trip-1', endTime);

    // Short walk is kept in DB (status=completed) but hidden from lists (visible=0, isValid=false).
    expect(result.isValid).toBe(false);
    expect(mockDb.updateTrip).toHaveBeenCalledWith('trip-1', expect.objectContaining({
      status: 'completed',
      visible: 0,
    }));
  });

  it('keeps a fast walk that exceeds the old 30 km/h speed threshold', async () => {
    // Was cancelled under the old Check 1 for walk; now the backend handles it
    const trip = makeTrip({ distance: 600, type: 'walk', max_speed: 35 });
    mockDb.getTrip.mockResolvedValue(trip);
    const locations = Array.from({ length: 10 }, (_, i) => ({
      latitude: 51 + i * 0.001,
      longitude: 0,
      timestamp: Date.now() - (10 - i) * 72000,
      accuracy: 15,
    }));
    mockDb.getLocationsByTrip.mockResolvedValue(locations as any);

    const result = await TripValidationService.validateAndFinalizeTrip('trip-1', endTime);

    expect(result.isValid).toBe(true);
    // Diagnostic note should be set but trip must not be cancelled
    expect(mockDb.updateTrip).toHaveBeenCalledWith('trip-1', expect.objectContaining({ status: 'completed' }));
  });

  it('discards a genuinely GPS-starved trip (both distance and point count below floor)', async () => {
    const trip = makeTrip({ distance: 10, type: 'walk', max_speed: 0, route_data: null });
    mockDb.getTrip.mockResolvedValue(trip);
    mockDb.getLocationsByTrip.mockResolvedValue([
      { latitude: 51, longitude: 0, timestamp: Date.now() - 1000, accuracy: 5 },
      { latitude: 51, longitude: 0, timestamp: Date.now(), accuracy: 5 },
    ] as any);

    const result = await TripValidationService.validateAndFinalizeTrip('trip-1', endTime);

    expect(result.isValid).toBe(false);
    expect(mockDb.updateTrip).toHaveBeenCalledWith('trip-1', expect.objectContaining({ status: 'cancelled' }));
  });

  it('records quality diagnostics in notes and hides the trip (visible=0)', async () => {
    // 300m walk under the 400m minimum — kept in DB but hidden from lists.
    const trip = makeTrip({ distance: 300, type: 'walk', max_speed: 40 });
    mockDb.getTrip.mockResolvedValue(trip);
    const locations = Array.from({ length: 15 }, (_, i) => ({
      latitude: 51 + i * 0.0003,
      longitude: 0,
      timestamp: Date.now() - (15 - i) * 48000,
      accuracy: 20,
    }));
    mockDb.getLocationsByTrip.mockResolvedValue(locations as any);

    const result = await TripValidationService.validateAndFinalizeTrip('trip-1', endTime);

    // Short walk: hidden (visible=0, isValid=false) but not cancelled.
    expect(result.isValid).toBe(false);
    const updateCall = mockDb.updateTrip.mock.calls.find(c => c[1]?.status === 'completed');
    expect(updateCall).toBeDefined();
    expect(updateCall?.[1]?.visible).toBe(0);
    // Diagnostic note should be present
    expect(updateCall?.[1]?.notes).toContain('km/h');
  });
});
