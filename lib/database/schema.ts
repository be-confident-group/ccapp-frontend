import * as SQLite from 'expo-sqlite';

export const DB_NAME = 'radzi.db';
export const DB_VERSION = 6;

export const SCHEMA = {
  trips: `
    CREATE TABLE IF NOT EXISTS trips (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT CHECK(type IN ('walk', 'run', 'cycle', 'drive')) DEFAULT 'walk',
      status TEXT CHECK(status IN ('active', 'paused', 'completed', 'cancelled')) DEFAULT 'active',
      is_manual INTEGER DEFAULT 0,
      start_time INTEGER NOT NULL,
      end_time INTEGER,
      distance REAL DEFAULT 0,
      duration INTEGER DEFAULT 0,
      avg_speed REAL DEFAULT 0,
      max_speed REAL DEFAULT 0,
      elevation_gain REAL DEFAULT 0,
      calories INTEGER DEFAULT 0,
      co2_saved REAL DEFAULT 0,
      notes TEXT,
      route_data TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      synced INTEGER DEFAULT 0,
      backend_id INTEGER,
      ml_activity_type TEXT,
      ml_confidence REAL,
      classification_method TEXT DEFAULT 'speed'
    )
  `,

  locations: `
    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      altitude REAL,
      accuracy REAL,
      speed REAL,
      heading REAL,
      timestamp INTEGER NOT NULL,
      activity_type TEXT,
      activity_confidence REAL,
      synced INTEGER DEFAULT 0,
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
    )
  `,

  settings: `
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `,

  sync_queue: `
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      data TEXT NOT NULL,
      retry_count INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      last_attempt INTEGER
    )
  `,

  route_ratings: `
    CREATE TABLE IF NOT EXISTS route_ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id TEXT NOT NULL,
      segments TEXT NOT NULL,
      rated_at INTEGER NOT NULL,
      synced INTEGER DEFAULT 0,
      backend_id INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `,

  // Per-window ML predictions produced by the on-device classifier.
  // One row per 256-sample window (~5.12 s at 50 Hz).
  activity_windows: `
    CREATE TABLE IF NOT EXISTS activity_windows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id TEXT NOT NULL,
      t_start INTEGER NOT NULL,
      t_end INTEGER NOT NULL,
      label TEXT NOT NULL,
      confidence REAL NOT NULL,
      probs_json TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
    )
  `,

  // Rolling raw IMU chunks (~60 s each) uploaded to the backend for model
  // retraining. Stored as opaque JSON so the frontend does not need to know
  // the final sample-data schema.
  sensor_batches: `
    CREATE TABLE IF NOT EXISTS sensor_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      payload_json TEXT NOT NULL,
      synced INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
    )
  `,

  motion_segments: `
    CREATE TABLE IF NOT EXISTS motion_segments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id TEXT NOT NULL,
      t_start INTEGER NOT NULL,
      t_end INTEGER NOT NULL,
      activity TEXT NOT NULL,
      confidence TEXT NOT NULL,
      source TEXT NOT NULL,
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
    )
  `,

  staging_locations: `
    CREATE TABLE IF NOT EXISTS staging_locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staging_id TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      accuracy REAL,
      speed REAL,
      timestamp INTEGER NOT NULL
    )
  `,

  classifier_disagreements: `
    CREATE TABLE IF NOT EXISTS classifier_disagreements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id TEXT NOT NULL,
      t INTEGER NOT NULL,
      xgb_label TEXT NOT NULL,
      cmma_label TEXT NOT NULL,
      xgb_conf REAL NOT NULL
    )
  `,
};

export const INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_trip_locations ON locations(trip_id)',
  'CREATE INDEX IF NOT EXISTS idx_trip_times ON trips(start_time, end_time)',
  'CREATE INDEX IF NOT EXISTS idx_trip_status ON trips(status)',
  'CREATE INDEX IF NOT EXISTS idx_location_synced ON locations(synced)',
  'CREATE INDEX IF NOT EXISTS idx_trip_synced ON trips(synced)',
  'CREATE INDEX IF NOT EXISTS idx_location_timestamp ON locations(timestamp)',
  'CREATE INDEX IF NOT EXISTS idx_rating_trip ON route_ratings(trip_id)',
  'CREATE INDEX IF NOT EXISTS idx_rating_synced ON route_ratings(synced)',
  'CREATE INDEX IF NOT EXISTS idx_activity_windows_trip ON activity_windows(trip_id, t_start)',
  'CREATE INDEX IF NOT EXISTS idx_sensor_batches_trip ON sensor_batches(trip_id, seq)',
  'CREATE INDEX IF NOT EXISTS idx_sensor_batches_synced ON sensor_batches(synced)',
  'CREATE INDEX IF NOT EXISTS idx_motion_segments_trip ON motion_segments(trip_id)',
  'CREATE INDEX IF NOT EXISTS idx_staging_id ON staging_locations(staging_id)',
  'CREATE INDEX IF NOT EXISTS idx_disagreements_trip ON classifier_disagreements(trip_id)',
];

export async function initializeDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);

  // Enable foreign keys
  await db.execAsync('PRAGMA foreign_keys = ON');
  await db.execAsync('PRAGMA journal_mode = WAL');

  // Check current version
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = result?.user_version || 0;
  console.log(`[Database] Current version: ${currentVersion}, Target version: ${DB_VERSION}`);

  // Create tables
  for (const [tableName, createSQL] of Object.entries(SCHEMA)) {
    await db.execAsync(createSQL);
    console.log(`[Database] Created table: ${tableName}`);
  }

  // Run migrations if needed
  if (currentVersion < DB_VERSION) {
    await runMigrations(db, currentVersion, DB_VERSION);
  }

  // Create indexes
  for (const indexSQL of INDEXES) {
    await db.execAsync(indexSQL);
  }
  console.log(`[Database] Created ${INDEXES.length} indexes`);

  // Set version
  await db.execAsync(`PRAGMA user_version = ${DB_VERSION}`);

  console.log('[Database] Initialized successfully');
  return db;
}

async function runMigrations(db: SQLite.SQLiteDatabase, from: number, to: number): Promise<void> {
  console.log(`[Database] Running migrations from version ${from} to ${to}`);

  // Migration from version 1 to 2: Add backend_id column
  if (from < 2 && to >= 2) {
    console.log('[Database] Migration 1->2: Adding backend_id column to trips table');
    try {
      await db.execAsync('ALTER TABLE trips ADD COLUMN backend_id INTEGER');
      console.log('[Database] Migration 1->2: Successfully added backend_id column');
    } catch (error) {
      // Column might already exist if migration was partially run
      console.log('[Database] Migration 1->2: backend_id column may already exist', error);
    }
  }

  // Migration from version 2 to 3: Add route_ratings table
  if (from < 3 && to >= 3) {
    console.log('[Database] Migration 2->3: Creating route_ratings table');
    try {
      await db.execAsync(SCHEMA.route_ratings);
      await db.execAsync('CREATE INDEX IF NOT EXISTS idx_rating_trip ON route_ratings(trip_id)');
      await db.execAsync('CREATE INDEX IF NOT EXISTS idx_rating_synced ON route_ratings(synced)');
      console.log('[Database] Migration 2->3: Successfully created route_ratings table');
    } catch (error) {
      // Table might already exist if migration was partially run
      console.log('[Database] Migration 2->3: route_ratings table may already exist', error);
    }
  }

  // Migration from version 3 to 4: Remove FOREIGN KEY constraint from route_ratings
  // This allows ratings for backend-only trips that don't exist in local trips table
  if (from < 4 && to >= 4) {
    console.log('[Database] Migration 3->4: Removing FOREIGN KEY constraint from route_ratings');
    try {
      // SQLite doesn't support dropping constraints, so we recreate the table
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS route_ratings_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          trip_id TEXT NOT NULL,
          segments TEXT NOT NULL,
          rated_at INTEGER NOT NULL,
          synced INTEGER DEFAULT 0,
          backend_id INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);
      // Copy existing data
      await db.execAsync(`
        INSERT INTO route_ratings_new (id, trip_id, segments, rated_at, synced, backend_id, created_at, updated_at)
        SELECT id, trip_id, segments, rated_at, synced, backend_id, created_at, updated_at
        FROM route_ratings
      `);
      // Drop old table and rename new one
      await db.execAsync('DROP TABLE route_ratings');
      await db.execAsync('ALTER TABLE route_ratings_new RENAME TO route_ratings');
      // Recreate indexes
      await db.execAsync('CREATE INDEX IF NOT EXISTS idx_rating_trip ON route_ratings(trip_id)');
      await db.execAsync('CREATE INDEX IF NOT EXISTS idx_rating_synced ON route_ratings(synced)');
      console.log('[Database] Migration 3->4: Successfully removed FOREIGN KEY constraint');
    } catch (error) {
      console.log('[Database] Migration 3->4: Error during migration', error);
    }
  }

  // Migration from version 4 to 5: Add activity_windows + sensor_batches tables,
  // and ML classification columns on trips.
  if (from < 5 && to >= 5) {
    console.log('[Database] Migration 4->5: Adding activity_windows + sensor_batches + ML columns');
    try {
      await db.execAsync(SCHEMA.activity_windows);
      await db.execAsync(SCHEMA.sensor_batches);
      for (const stmt of [
        'ALTER TABLE trips ADD COLUMN ml_activity_type TEXT',
        'ALTER TABLE trips ADD COLUMN ml_confidence REAL',
        "ALTER TABLE trips ADD COLUMN classification_method TEXT DEFAULT 'speed'",
      ]) {
        try {
          await db.execAsync(stmt);
        } catch (err) {
          console.log(`[Database] Migration 4->5: ALTER skipped (likely exists): ${stmt}`);
        }
      }
      await db.execAsync(
        'CREATE INDEX IF NOT EXISTS idx_activity_windows_trip ON activity_windows(trip_id, t_start)'
      );
      await db.execAsync(
        'CREATE INDEX IF NOT EXISTS idx_sensor_batches_trip ON sensor_batches(trip_id, seq)'
      );
      await db.execAsync(
        'CREATE INDEX IF NOT EXISTS idx_sensor_batches_synced ON sensor_batches(synced)'
      );
      console.log('[Database] Migration 4->5: Tables created');
    } catch (error) {
      console.log('[Database] Migration 4->5: Error (may already exist)', error);
    }
  }

  // Migration from version 5 to 6: Add native engine columns, new motion/staging/disagreement tables
  if (from < 6 && to >= 6) {
    console.log('[Database] Migration 5->6: Adding native engine columns and new tables');

    // Idempotent ALTER TABLE statements (wrapped in try/catch for duplicate column errors)
    for (const stmt of [
      "ALTER TABLE trips ADD COLUMN engine TEXT DEFAULT 'legacy'",
      'ALTER TABLE trips ADD COLUMN backfill_start INTEGER',
      'ALTER TABLE trips ADD COLUMN detection_state TEXT',
      "ALTER TABLE locations ADD COLUMN gps_accuracy_mode TEXT DEFAULT 'best'",
    ]) {
      try {
        await db.execAsync(stmt);
      } catch (err) {
        console.log(`[Database] Migration 5->6: ALTER skipped (likely exists): ${stmt}`);
      }
    }

    // New tables
    await db.execAsync(SCHEMA.motion_segments);
    await db.execAsync(
      'CREATE INDEX IF NOT EXISTS idx_motion_segments_trip ON motion_segments(trip_id)'
    );

    await db.execAsync(SCHEMA.staging_locations);
    await db.execAsync(
      'CREATE INDEX IF NOT EXISTS idx_staging_id ON staging_locations(staging_id)'
    );

    await db.execAsync(SCHEMA.classifier_disagreements);
    await db.execAsync(
      'CREATE INDEX IF NOT EXISTS idx_disagreements_trip ON classifier_disagreements(trip_id)'
    );

    // Backfill existing trips as legacy (no-op since DEFAULT 'legacy' already sets them)
    await db.execAsync("UPDATE trips SET engine = 'legacy' WHERE engine IS NULL OR engine = ''");

    console.log('[Database] Migration 5->6: Completed');
  }

  console.log('[Database] Migrations completed');
}
