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
