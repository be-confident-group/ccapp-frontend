import { transformTripForApi } from '../trips';
import type { DBTrip } from '../trips';

const baseTripDb: DBTrip = {
  id: 'trip_1',
  user_id: 'u1',
  type: 'cycle',
  status: 'completed',
  is_manual: 0,
  start_time: 1000000,
  end_time: 1003600,
  distance: 10000,
  duration: 3600,
  avg_speed: 10,
  max_speed: 20,
  elevation_gain: 50,
  calories: 200,
  co2_saved: 1.5,
  notes: null,
  route_data: null,
  created_at: 1000000,
  updated_at: 1003600,
  synced: 0,
  backend_id: null,
  ml_activity_type: null,
  ml_confidence: null,
  classification_method: null,
  engine: null,
  backfill_start: null,
  detection_state: null,
  // v7 fields
  user_note: 'Great ride!',
  validation_log: null,
  user_note_dirty: 0,
  type_dirty: 0,
  classification_source: 'apple_motion',
  moving_duration_s: 3000,
  moving_avg_speed_kmh: 12,
  max_speed_filtered_kmh: 25,
  elevation_loss_m: 30,
  backend_avg_speed_kmh: null,
  visible: 1,
};

describe('transformTripForApi', () => {
  it('sends classification_source instead of classification_method', () => {
    const result = transformTripForApi(baseTripDb);
    expect(result.classification_source).toBe('apple_motion');
    expect((result as any).classification_method).toBeUndefined();
  });

  it('sends user_note', () => {
    const result = transformTripForApi(baseTripDb);
    expect(result.user_note).toBe('Great ride!');
  });

  it('sends elevation_loss', () => {
    const result = transformTripForApi(baseTripDb);
    expect(result.elevation_loss).toBe(30);
  });

  it('throws when native trip has no classification_source', () => {
    const trip = { ...baseTripDb, classification_source: null, engine: 'native' };
    expect(() => transformTripForApi(trip as any)).toThrow('no classification_source');
  });
});
