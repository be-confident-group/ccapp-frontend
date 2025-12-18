import * as SQLite from 'expo-sqlite';

export const DB_NAME = 'radzi.db';
export const DB_VERSION = 2;

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
      backend_id INTEGER
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
};

export const INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_trip_locations ON locations(trip_id)',
  'CREATE INDEX IF NOT EXISTS idx_trip_times ON trips(start_time, end_time)',
  'CREATE INDEX IF NOT EXISTS idx_trip_status ON trips(status)',
  'CREATE INDEX IF NOT EXISTS idx_location_synced ON locations(synced)',
  'CREATE INDEX IF NOT EXISTS idx_trip_synced ON trips(synced)',
  'CREATE INDEX IF NOT EXISTS idx_location_timestamp ON locations(timestamp)',
];

export async function initializeDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);

  // Enable foreign keys
  await db.execAsync('PRAGMA foreign_keys = ON');

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

  console.log('[Database] Migrations completed');
}
