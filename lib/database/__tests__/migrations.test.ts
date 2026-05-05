import { openDatabaseSync } from 'expo-sqlite';
import { runMigrations, runMigrationsUpTo } from '../schema';

describe('schema v7 migration', () => {
  it('adds new trip columns with safe defaults', async () => {
    const db = openDatabaseSync(':memory:');
    await runMigrationsUpTo(db, 7);

    const cols = db.getAllSync<{ name: string }>(`PRAGMA table_info(trips);`).map(r => r.name);

    expect(cols).toContain('user_note');
    expect(cols).toContain('validation_log');
    expect(cols).toContain('user_note_dirty');
    expect(cols).toContain('type_dirty');
    expect(cols).toContain('classification_source');
    expect(cols).toContain('moving_duration_s');
    expect(cols).toContain('moving_avg_speed_kmh');
    expect(cols).toContain('max_speed_filtered_kmh');
    expect(cols).toContain('elevation_loss_m');
    expect(cols).toContain('backend_avg_speed_kmh');
  });

  it('is idempotent — running v7 migration twice does not throw', async () => {
    const db = openDatabaseSync(':memory:');
    await runMigrationsUpTo(db, 7);
    await expect(runMigrationsUpTo(db, 7)).resolves.toBeUndefined();
  });
});

describe('schema v8 migration', () => {
  it('creates trip_altitude_samples and activity_history_snapshot tables', async () => {
    const db = openDatabaseSync(':memory:');
    await runMigrationsUpTo(db, 8);

    const tables = db
      .getAllSync<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type='table';`
      )
      .map((r) => r.name);

    expect(tables).toContain('trip_altitude_samples');
    expect(tables).toContain('activity_history_snapshot');

    const altCols = db
      .getAllSync<{ name: string }>(`PRAGMA table_info(trip_altitude_samples);`)
      .map((r) => r.name);
    expect(altCols).toEqual(
      expect.arrayContaining(['trip_id', 'timestamp', 'relative_altitude_m'])
    );
  });

  it('is idempotent — running v8 migration twice does not throw', async () => {
    const db = openDatabaseSync(':memory:');
    await runMigrationsUpTo(db, 8);
    await expect(runMigrationsUpTo(db, 8)).resolves.toBeUndefined();
  });
});

describe('schema v9 migration', () => {
  it('backfills auto-generated notes into validation_log', async () => {
    const db = openDatabaseSync(':memory:');
    // Set up base schema through v8 (columns exist, no backfill yet)
    await runMigrationsUpTo(db, 8);

    // Insert two trips with legacy notes
    db.runSync(
      `INSERT INTO trips (id, user_id, type, status, is_manual, start_time, end_time, distance, duration, avg_speed, max_speed, elevation_gain, calories, co2_saved, notes, route_data, created_at, updated_at, synced)
       VALUES ('t1','u','cycle','completed',0,1,2,100,10,1,1,0,0,0,'Trip contains driving (max speed: 50 km/h)','[]',1,1,0),
              ('t2','u','cycle','completed',0,1,2,100,10,1,1,0,0,0,'Beautiful coastal route','[]',1,1,0)`
    );

    // Now run v9
    await runMigrationsUpTo(db, 9);

    const t1 = db.getFirstSync<{ user_note: string | null; validation_log: string | null }>(
      `SELECT user_note, validation_log FROM trips WHERE id='t1'`
    );
    const t2 = db.getFirstSync<{ user_note: string | null; validation_log: string | null }>(
      `SELECT user_note, validation_log FROM trips WHERE id='t2'`
    );

    expect(t1!.user_note).toBeNull();
    expect(t1!.validation_log).toBe('Trip contains driving (max speed: 50 km/h)');
    expect(t2!.user_note).toBe('Beautiful coastal route');
    expect(t2!.validation_log).toBeNull();
  });

  it('leaves notes=NULL rows untouched', async () => {
    const db = openDatabaseSync(':memory:');
    await runMigrationsUpTo(db, 8);
    db.runSync(
      `INSERT INTO trips (id, user_id, type, status, is_manual, start_time, end_time, distance, duration, avg_speed, max_speed, elevation_gain, calories, co2_saved, notes, route_data, created_at, updated_at, synced)
       VALUES ('t3','u','walk','completed',0,1,2,1,1,0,0,0,0,0,NULL,'[]',1,1,0)`
    );
    await runMigrationsUpTo(db, 9);
    const t3 = db.getFirstSync<{ user_note: string | null; validation_log: string | null }>(
      `SELECT user_note, validation_log FROM trips WHERE id='t3'`
    );
    expect(t3!.user_note).toBeNull();
    expect(t3!.validation_log).toBeNull();
  });
});
