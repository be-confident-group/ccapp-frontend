/**
 * Database Test Script
 *
 * This file can be imported and run to test database initialization.
 * Call testDatabase() from your app to verify everything works.
 */

import { database } from './db';

export async function testDatabase(): Promise<boolean> {
  try {
    console.log('[DB Test] Starting database test...');

    // Initialize database
    await database.init();
    console.log('[DB Test] ✓ Database initialized');

    // Get stats
    const stats = await database.getStats();
    console.log('[DB Test] ✓ Database stats:', stats);

    // Test setting
    await database.setSetting('test_key', 'test_value');
    const value = await database.getSetting('test_key');
    console.log('[DB Test] ✓ Settings work:', value === 'test_value');

    // Test trip creation
    const testTrip = {
      id: `test_${Date.now()}`,
      user_id: 'test_user',
      type: 'walk' as const,
      status: 'active' as const,
      is_manual: 0,
      start_time: Date.now(),
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    await database.createTrip(testTrip);
    console.log('[DB Test] ✓ Trip created');

    const retrieved = await database.getTrip(testTrip.id);
    console.log('[DB Test] ✓ Trip retrieved:', retrieved?.id === testTrip.id);

    // Test location
    await database.addLocation({
      trip_id: testTrip.id,
      latitude: 37.7749,
      longitude: -122.4194,
      altitude: 10,
      accuracy: 5,
      speed: 1.5,
      heading: 0,
      timestamp: Date.now(),
      activity_type: 'walking',
      activity_confidence: 0.85,
      synced: 0,
    });
    console.log('[DB Test] ✓ Location added');

    const locations = await database.getLocationsByTrip(testTrip.id);
    console.log('[DB Test] ✓ Locations retrieved:', locations.length);

    // Cleanup test data
    await database.deleteTrip(testTrip.id);
    console.log('[DB Test] ✓ Test data cleaned up');

    console.log('[DB Test] ✅ All tests passed!');
    return true;
  } catch (error) {
    console.error('[DB Test] ❌ Test failed:', error);
    return false;
  }
}
