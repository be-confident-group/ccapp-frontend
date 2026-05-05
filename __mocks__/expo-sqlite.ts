/**
 * Jest mock for expo-sqlite.
 * Uses better-sqlite3 to provide a real in-memory SQLite database,
 * exposing the same async/sync API surface that schema.ts depends on.
 */
import BetterSQLite3 from 'better-sqlite3';

class MockSQLiteDatabase {
  private _db: BetterSQLite3.Database;

  constructor(_path: string) {
    // Always use in-memory for tests
    this._db = new BetterSQLite3(':memory:');
  }

  async execAsync(source: string): Promise<void> {
    this._db.exec(source);
  }

  async getFirstAsync<T>(source: string, ...params: unknown[]): Promise<T | null> {
    const stmt = this._db.prepare(source);
    const row = stmt.get(...(params as unknown[])) as T | undefined;
    return row ?? null;
  }

  async getAllAsync<T>(source: string, ...params: unknown[]): Promise<T[]> {
    const stmt = this._db.prepare(source);
    return stmt.all(...(params as unknown[])) as T[];
  }

  getAllSync<T>(source: string, ...params: unknown[]): T[] {
    const stmt = this._db.prepare(source);
    return stmt.all(...(params as unknown[])) as T[];
  }

  getFirstSync<T>(source: string, ...params: unknown[]): T | null {
    const stmt = this._db.prepare(source);
    const row = stmt.get(...(params as unknown[])) as T | undefined;
    return row ?? null;
  }

  runSync(source: string, ...params: unknown[]): void {
    const stmt = this._db.prepare(source);
    stmt.run(...(params as unknown[]));
  }

  async runAsync(source: string, params?: unknown[]): Promise<void> {
    const stmt = this._db.prepare(source);
    if (params && params.length > 0) {
      stmt.run(...(params as unknown[]));
    } else {
      stmt.run();
    }
  }

  async closeAsync(): Promise<void> {
    this._db.close();
  }
}

export function openDatabaseSync(path: string): MockSQLiteDatabase {
  return new MockSQLiteDatabase(path);
}

export async function openDatabaseAsync(path: string): Promise<MockSQLiteDatabase> {
  return new MockSQLiteDatabase(path);
}

export type SQLiteDatabase = MockSQLiteDatabase;
