import { openDatabaseSync } from 'expo-sqlite';
import { runMigrationsUpTo } from '../schema';

describe('getTrips visible filter', () => {
  it('excludes trips with visible=0', async () => {
    const db = openDatabaseSync(':memory:');
    await runMigrationsUpTo(db, 10);

    // Insert one visible and one hidden trip
    db.runSync(
      `INSERT INTO trips (id, user_id, type, status, is_manual, start_time, end_time, distance, duration, avg_speed, max_speed, elevation_gain, calories, co2_saved, notes, route_data, created_at, updated_at, synced, visible)
       VALUES ('t1','u','cycle','completed',0,1,2,100,10,1,1,0,0,0,NULL,'[]',1,1,0,1),
              ('t2','u','drive','completed',0,1,2,100,10,1,1,0,0,0,NULL,'[]',1,1,0,0)`
    );

    const rows = db.getAllSync<{ id: string }>(
      `SELECT * FROM trips WHERE (visible = 1 OR visible IS NULL)`
    );
    expect(rows.map(r => r.id)).toEqual(['t1']);
    expect(rows.map(r => r.id)).not.toContain('t2');
  });
});
