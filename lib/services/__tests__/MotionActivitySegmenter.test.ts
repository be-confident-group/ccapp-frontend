import { MotionActivitySegmenter } from '../MotionActivitySegmenter';
import { database } from '../../database';

jest.mock('../../database', () => ({
  database: {
    getMotionSegmentsByTrip: jest.fn(),
    getLocationsByTrip: jest.fn(),
  },
}));

describe('MotionActivitySegmenter', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns empty result for trip with no segments', async () => {
    (database.getMotionSegmentsByTrip as jest.Mock).mockResolvedValue([]);
    (database.getLocationsByTrip as jest.Mock).mockResolvedValue([]);
    const result = await MotionActivitySegmenter.analyze('trip_1');
    expect(result.segments).toEqual([]);
    expect(result.isMultiModal).toBe(false);
  });

  it('builds a single walking segment from one motion record', async () => {
    (database.getMotionSegmentsByTrip as jest.Mock).mockResolvedValue([
      { id: 1, trip_id: 'trip_1', t_start: 1000, t_end: 200000, activity: 'walking', confidence: 'high', source: 'cmma' },
    ]);
    (database.getLocationsByTrip as jest.Mock).mockResolvedValue([
      { trip_id: 'trip_1', latitude: 51.5, longitude: -0.1, accuracy: 5, speed: 1.4, timestamp: 1000 },
      { trip_id: 'trip_1', latitude: 51.501, longitude: -0.1, accuracy: 5, speed: 1.4, timestamp: 200000 },
    ]);
    const result = await MotionActivitySegmenter.analyze('trip_1');
    expect(result.segments.length).toBe(1);
    expect(result.segments[0].type).toBe('walk');
    expect(result.segments[0].distance).toBeGreaterThan(100);
    expect(result.dominantType).toBe('walk');
    expect(result.isMultiModal).toBe(false);
  });

  it('detects multi-modal trip (walk + drive)', async () => {
    (database.getMotionSegmentsByTrip as jest.Mock).mockResolvedValue([
      { id: 1, trip_id: 'trip_1', t_start: 1000, t_end: 200000, activity: 'walking', confidence: 'high', source: 'cmma' },
      { id: 2, trip_id: 'trip_1', t_start: 200000, t_end: 400000, activity: 'automotive', confidence: 'high', source: 'cmma' },
    ]);
    (database.getLocationsByTrip as jest.Mock).mockResolvedValue([
      { trip_id: 'trip_1', latitude: 51.5, longitude: -0.1, accuracy: 5, speed: 1.4, timestamp: 1000 },
      { trip_id: 'trip_1', latitude: 51.501, longitude: -0.1, accuracy: 5, speed: 1.4, timestamp: 200000 },
      { trip_id: 'trip_1', latitude: 51.51, longitude: -0.1, accuracy: 5, speed: 14, timestamp: 400000 },
    ]);
    const result = await MotionActivitySegmenter.analyze('trip_1');
    expect(result.segments.length).toBe(2);
    expect(result.isMultiModal).toBe(true);
    expect(result.segments[0].type).toBe('walk');
    expect(result.segments[1].type).toBe('drive');
  });

  it('filters out segments shorter than thresholds', async () => {
    (database.getMotionSegmentsByTrip as jest.Mock).mockResolvedValue([
      { id: 1, trip_id: 'trip_1', t_start: 1000, t_end: 5000, activity: 'walking', confidence: 'high', source: 'cmma' },
    ]);
    (database.getLocationsByTrip as jest.Mock).mockResolvedValue([
      { trip_id: 'trip_1', latitude: 51.5, longitude: -0.1, accuracy: 5, speed: 1.4, timestamp: 1000 },
      { trip_id: 'trip_1', latitude: 51.5001, longitude: -0.1, accuracy: 5, speed: 1.4, timestamp: 5000 },
    ]);
    const result = await MotionActivitySegmenter.analyze('trip_1');
    expect(result.segments.length).toBe(0);
  });

  it('merges adjacent same-type segments', async () => {
    (database.getMotionSegmentsByTrip as jest.Mock).mockResolvedValue([
      { id: 1, trip_id: 'trip_1', t_start: 1000, t_end: 100000, activity: 'walking', confidence: 'high', source: 'cmma' },
      { id: 2, trip_id: 'trip_1', t_start: 100000, t_end: 200000, activity: 'walking', confidence: 'medium', source: 'cmma' },
    ]);
    (database.getLocationsByTrip as jest.Mock).mockResolvedValue([
      { trip_id: 'trip_1', latitude: 51.5, longitude: -0.1, accuracy: 5, speed: 1.4, timestamp: 1000 },
      { trip_id: 'trip_1', latitude: 51.501, longitude: -0.1, accuracy: 5, speed: 1.4, timestamp: 100000 },
      { trip_id: 'trip_1', latitude: 51.502, longitude: -0.1, accuracy: 5, speed: 1.4, timestamp: 200000 },
    ]);
    const result = await MotionActivitySegmenter.analyze('trip_1');
    expect(result.segments.length).toBe(1);
    expect(result.segments[0].type).toBe('walk');
  });
});
