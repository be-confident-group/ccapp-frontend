import * as SQLite from 'expo-sqlite';
import { initializeDatabase, DB_NAME } from './schema';

export interface Trip {
  id: string;
  user_id: string;
  type: 'walk' | 'run' | 'cycle' | 'drive';
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  is_manual: number;
  start_time: number;
  end_time: number | null;
  distance: number;
  duration: number;
  avg_speed: number;
  max_speed: number;
  elevation_gain: number;
  calories: number;
  co2_saved: number;
  notes: string | null;
  route_data: string | null;
  created_at: number;
  updated_at: number;
  synced: number;
  backend_id: number | null;
}

export interface LocationPoint {
  id?: number;
  trip_id: string;
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  timestamp: number;
  activity_type: string | null;
  activity_confidence: number | null;
  synced: number;
}

export interface Setting {
  key: string;
  value: string;
  updated_at: number;
}

export interface SyncQueueItem {
  id?: number;
  type: string;
  data: string;
  retry_count: number;
  created_at: number;
  last_attempt: number | null;
}

export interface RouteRating {
  id?: number;
  trip_id: string;
  segments: string; // JSON stringified RouteSegment[]
  rated_at: number;
  synced: number;
  backend_id: number | null;
  created_at: number;
  updated_at: number;
}

export interface TripFilters {
  type?: 'walk' | 'run' | 'cycle' | 'drive';
  status?: 'active' | 'paused' | 'completed' | 'cancelled';
  synced?: boolean;
  startDate?: number;
  endDate?: number;
}

class Database {
  private db: SQLite.SQLiteDatabase | null = null;
  private initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

  async init(): Promise<SQLite.SQLiteDatabase> {
    if (this.db) {
      return this.db;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = initializeDatabase();
    this.db = await this.initPromise;
    this.initPromise = null;

    return this.db;
  }

  async getDb(): Promise<SQLite.SQLiteDatabase> {
    if (!this.db) {
      await this.init();
    }
    return this.db!;
  }

  // ===== TRIPS CRUD =====

  async createTrip(trip: Partial<Trip>): Promise<void> {
    const db = await this.getDb();

    await db.runAsync(
      `INSERT INTO trips
       (id, user_id, type, status, is_manual, start_time, end_time, distance, duration,
        avg_speed, max_speed, elevation_gain, calories, co2_saved, notes, route_data,
        created_at, updated_at, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        trip.id!,
        trip.user_id!,
        trip.type || 'walk',
        trip.status || 'active',
        trip.is_manual || 0,
        trip.start_time!,
        trip.end_time || null,
        trip.distance || 0,
        trip.duration || 0,
        trip.avg_speed || 0,
        trip.max_speed || 0,
        trip.elevation_gain || 0,
        trip.calories || 0,
        trip.co2_saved || 0,
        trip.notes || null,
        trip.route_data || null,
        trip.created_at!,
        trip.updated_at!,
        trip.synced || 0,
      ]
    );
  }

  async getTrip(id: string): Promise<Trip | null> {
    const db = await this.getDb();
    const result = await db.getFirstAsync<Trip>(
      'SELECT * FROM trips WHERE id = ?',
      [id]
    );
    return result || null;
  }

  async updateTrip(id: string, updates: Partial<Trip>): Promise<void> {
    const db = await this.getDb();

    const fields: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }

    if (fields.length === 0) return;

    values.push(id);

    await db.runAsync(
      `UPDATE trips SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  }

  async deleteTrip(id: string): Promise<void> {
    const db = await this.getDb();
    await db.runAsync('DELETE FROM trips WHERE id = ?', [id]);
  }

  async getAllTrips(filters?: TripFilters): Promise<Trip[]> {
    const db = await this.getDb();

    let query = 'SELECT * FROM trips WHERE 1=1';
    const params: any[] = [];

    if (filters) {
      if (filters.type) {
        query += ' AND type = ?';
        params.push(filters.type);
      }
      if (filters.status) {
        query += ' AND status = ?';
        params.push(filters.status);
      }
      if (filters.synced !== undefined) {
        query += ' AND synced = ?';
        params.push(filters.synced ? 1 : 0);
      }
      if (filters.startDate) {
        query += ' AND start_time >= ?';
        params.push(filters.startDate);
      }
      if (filters.endDate) {
        query += ' AND start_time <= ?';
        params.push(filters.endDate);
      }
    }

    query += ' ORDER BY start_time DESC';

    const results = await db.getAllAsync<Trip>(query, params);
    return results;
  }

  async getActiveTrip(): Promise<Trip | null> {
    const db = await this.getDb();
    const result = await db.getFirstAsync<Trip>(
      "SELECT * FROM trips WHERE status = 'active' LIMIT 1"
    );
    return result || null;
  }

  // ===== LOCATIONS CRUD =====

  async addLocation(location: LocationPoint): Promise<void> {
    const db = await this.getDb();

    await db.runAsync(
      `INSERT INTO locations
       (trip_id, latitude, longitude, altitude, accuracy, speed, heading,
        timestamp, activity_type, activity_confidence, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        location.trip_id,
        location.latitude,
        location.longitude,
        location.altitude,
        location.accuracy,
        location.speed,
        location.heading,
        location.timestamp,
        location.activity_type,
        location.activity_confidence,
        location.synced || 0,
      ]
    );
  }

  async getLocationsByTrip(tripId: string): Promise<LocationPoint[]> {
    const db = await this.getDb();
    const results = await db.getAllAsync<LocationPoint>(
      'SELECT * FROM locations WHERE trip_id = ? ORDER BY timestamp ASC',
      [tripId]
    );
    return results;
  }

  async getUnsyncedLocations(limit: number = 1000): Promise<LocationPoint[]> {
    const db = await this.getDb();
    const results = await db.getAllAsync<LocationPoint>(
      'SELECT * FROM locations WHERE synced = 0 ORDER BY timestamp ASC LIMIT ?',
      [limit]
    );
    return results;
  }

  async markLocationsSynced(locationIds: number[]): Promise<void> {
    if (locationIds.length === 0) return;

    const db = await this.getDb();
    const placeholders = locationIds.map(() => '?').join(',');

    await db.runAsync(
      `UPDATE locations SET synced = 1 WHERE id IN (${placeholders})`,
      locationIds
    );
  }

  async deleteLocationsByTrip(tripId: string): Promise<void> {
    const db = await this.getDb();
    await db.runAsync('DELETE FROM locations WHERE trip_id = ?', [tripId]);
  }

  // ===== SETTINGS =====

  async getSetting(key: string): Promise<string | null> {
    const db = await this.getDb();
    const result = await db.getFirstAsync<Setting>(
      'SELECT * FROM settings WHERE key = ?',
      [key]
    );
    return result ? result.value : null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    const db = await this.getDb();
    const now = Date.now();

    await db.runAsync(
      `INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)`,
      [key, value, now]
    );
  }

  async getAllSettings(): Promise<Setting[]> {
    const db = await this.getDb();
    const results = await db.getAllAsync<Setting>('SELECT * FROM settings');
    return results;
  }

  // ===== SYNC QUEUE =====

  async addToSyncQueue(type: string, data: any): Promise<void> {
    const db = await this.getDb();
    const now = Date.now();

    await db.runAsync(
      `INSERT INTO sync_queue (type, data, retry_count, created_at, last_attempt)
       VALUES (?, ?, 0, ?, NULL)`,
      [type, JSON.stringify(data), now]
    );
  }

  async getSyncQueue(): Promise<SyncQueueItem[]> {
    const db = await this.getDb();
    const results = await db.getAllAsync<SyncQueueItem>(
      'SELECT * FROM sync_queue ORDER BY created_at ASC'
    );
    return results;
  }

  async removeSyncQueueItem(id: number): Promise<void> {
    const db = await this.getDb();
    await db.runAsync('DELETE FROM sync_queue WHERE id = ?', [id]);
  }

  async updateSyncQueueRetry(id: number): Promise<void> {
    const db = await this.getDb();
    const now = Date.now();

    await db.runAsync(
      'UPDATE sync_queue SET retry_count = retry_count + 1, last_attempt = ? WHERE id = ?',
      [now, id]
    );
  }

  // ===== ROUTE RATINGS CRUD =====

  async createRating(rating: Partial<RouteRating>): Promise<void> {
    const db = await this.getDb();
    const now = Date.now();

    await db.runAsync(
      `INSERT INTO route_ratings
       (trip_id, segments, rated_at, synced, backend_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        rating.trip_id!,
        rating.segments!,
        rating.rated_at || now,
        rating.synced || 0,
        rating.backend_id || null,
        rating.created_at || now,
        rating.updated_at || now,
      ]
    );
  }

  async getRating(tripId: string): Promise<RouteRating | null> {
    const db = await this.getDb();
    const result = await db.getFirstAsync<RouteRating>(
      'SELECT * FROM route_ratings WHERE trip_id = ?',
      [tripId]
    );
    return result || null;
  }

  async updateRating(tripId: string, updates: Partial<RouteRating>): Promise<void> {
    const db = await this.getDb();

    const fields: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }

    if (fields.length === 0) return;

    // Always update updated_at
    fields.push('updated_at = ?');
    values.push(Date.now());

    values.push(tripId);

    await db.runAsync(
      `UPDATE route_ratings SET ${fields.join(', ')} WHERE trip_id = ?`,
      values
    );
  }

  async deleteRating(tripId: string): Promise<void> {
    const db = await this.getDb();
    await db.runAsync('DELETE FROM route_ratings WHERE trip_id = ?', [tripId]);
  }

  async getUnratedTrips(): Promise<Trip[]> {
    const db = await this.getDb();
    // Get completed trips that have route_data and no rating
    const results = await db.getAllAsync<Trip>(
      `SELECT t.* FROM trips t
       LEFT JOIN route_ratings r ON t.id = r.trip_id
       WHERE t.status = 'completed'
         AND t.route_data IS NOT NULL
         AND t.route_data != ''
         AND r.id IS NULL
       ORDER BY t.start_time DESC`
    );
    return results;
  }

  async getUnratedTripsCount(): Promise<number> {
    const db = await this.getDb();
    const result = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM trips t
       LEFT JOIN route_ratings r ON t.id = r.trip_id
       WHERE t.status = 'completed'
         AND t.route_data IS NOT NULL
         AND t.route_data != ''
         AND r.id IS NULL`
    );
    return result?.count || 0;
  }

  async getUnsyncedRatings(): Promise<RouteRating[]> {
    const db = await this.getDb();
    const results = await db.getAllAsync<RouteRating>(
      'SELECT * FROM route_ratings WHERE synced = 0 ORDER BY created_at ASC'
    );
    return results;
  }

  async markRatingSynced(tripId: string, backendId: number): Promise<void> {
    const db = await this.getDb();
    await db.runAsync(
      'UPDATE route_ratings SET synced = 1, backend_id = ?, updated_at = ? WHERE trip_id = ?',
      [backendId, Date.now(), tripId]
    );
  }

  async hasRating(tripId: string): Promise<boolean> {
    const db = await this.getDb();
    const result = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM route_ratings WHERE trip_id = ?',
      [tripId]
    );
    return (result?.count || 0) > 0;
  }

  async getAllRatings(): Promise<RouteRating[]> {
    const db = await this.getDb();
    const results = await db.getAllAsync<RouteRating>(
      'SELECT * FROM route_ratings ORDER BY rated_at DESC'
    );
    return results;
  }

  // ===== UTILITY =====

  async clearAllData(): Promise<void> {
    const db = await this.getDb();
    await db.execAsync('DELETE FROM trips');
    await db.execAsync('DELETE FROM locations');
    await db.execAsync('DELETE FROM sync_queue');
    await db.execAsync('DELETE FROM route_ratings');
    console.log('[Database] All data cleared');
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
      console.log('[Database] Closed');
    }
  }

  async getStats(): Promise<{
    totalTrips: number;
    activeTrips: number;
    totalLocations: number;
    unsyncedTrips: number;
    queuedSyncs: number;
  }> {
    const db = await this.getDb();

    const totalTrips = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM trips'
    );

    const activeTrips = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM trips WHERE status = 'active'"
    );

    const totalLocations = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM locations'
    );

    const unsyncedTrips = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM trips WHERE synced = 0'
    );

    const queuedSyncs = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM sync_queue'
    );

    return {
      totalTrips: totalTrips?.count || 0,
      activeTrips: activeTrips?.count || 0,
      totalLocations: totalLocations?.count || 0,
      unsyncedTrips: unsyncedTrips?.count || 0,
      queuedSyncs: queuedSyncs?.count || 0,
    };
  }
}

// Export singleton instance
export const database = new Database();
