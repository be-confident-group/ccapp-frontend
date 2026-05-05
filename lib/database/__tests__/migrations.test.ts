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
});
