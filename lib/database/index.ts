/**
 * Database Module
 *
 * Export all database-related types and functions
 */

export { database } from './db';
export type {
  Trip,
  LocationPoint,
  Setting,
  SyncQueueItem,
  TripFilters,
} from './db';

export { initializeDatabase, DB_NAME, DB_VERSION, SCHEMA, INDEXES } from './schema';
export { testDatabase } from './test-db';
