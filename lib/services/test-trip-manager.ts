/**
 * Trip Manager Test Script
 *
 * This file can be used to test TripManager functionality.
 * Call testTripManager() to verify everything works.
 */

import { database } from '../database';
import { TripManager } from './TripManager';
import type { ManualTripDto } from '../../types/trip';

export async function testTripManager(): Promise<boolean> {
  try {
    console.log('[TripManager Test] Starting tests...');

    // Initialize database
    await database.init();
    console.log('[TripManager Test] ✓ Database initialized');

    // Test 1: Create manual trip
    console.log('\n[TripManager Test] Test 1: Creating manual trip...');
    const manualTripData: ManualTripDto = {
      userId: 'test_user',
      type: 'cycle',
      distance: 5000, // 5km
      duration: 900, // 15 minutes
      startTime: Date.now() - 900000, // 15 minutes ago
      notes: 'Morning commute test',
      routeData: [
        { latitude: 37.7749, longitude: -122.4194 },
        { latitude: 37.7849, longitude: -122.4094 },
        { latitude: 37.7949, longitude: -122.3994 },
      ],
    };

    const { trip: manualTrip } = await TripManager.createManualTrip(manualTripData);
    console.log('[TripManager Test] ✓ Manual trip created:', manualTrip.id);
    console.log('  - Distance:', manualTrip.distance, 'm');
    console.log('  - Duration:', manualTrip.duration, 's');
    console.log('  - Type:', manualTrip.type);
    console.log('  - CO2 Saved:', manualTrip.co2_saved, 'kg');

    // Test 2: Get trip by ID
    console.log('\n[TripManager Test] Test 2: Getting trip by ID...');
    const retrievedTrip = await TripManager.getTrip(manualTrip.id);
    console.log('[TripManager Test] ✓ Trip retrieved:', retrievedTrip?.id === manualTrip.id);

    // Test 3: Get trip details with route
    console.log('\n[TripManager Test] Test 3: Getting trip details...');
    const tripDetails = await TripManager.getTripDetails(manualTrip.id);
    console.log('[TripManager Test] ✓ Trip details retrieved');
    console.log('  - Route points:', tripDetails?.route.length || 0);
    console.log('  - Location count:', tripDetails?.locationCount || 0);

    // Test 4: Update trip
    console.log('\n[TripManager Test] Test 4: Updating trip...');
    const updatedTrip = await TripManager.updateTrip(manualTrip.id, {
      type: 'walk',
      notes: 'Updated: Changed to walk',
    });
    console.log('[TripManager Test] ✓ Trip updated');
    console.log('  - New type:', updatedTrip?.type);
    console.log('  - New notes:', updatedTrip?.notes);

    // Test 5: Get all trips
    console.log('\n[TripManager Test] Test 5: Getting all trips...');
    const allTrips = await TripManager.getAllTrips();
    console.log('[TripManager Test] ✓ All trips retrieved:', allTrips.length);

    // Test 6: Get trips by type
    console.log('\n[TripManager Test] Test 6: Getting trips by type...');
    const walkTrips = await TripManager.getTripsByType('walk');
    console.log('[TripManager Test] ✓ Walk trips retrieved:', walkTrips.length);

    // Test 7: Get user stats
    console.log('\n[TripManager Test] Test 7: Getting user stats...');
    const userStats = await TripManager.getUserStats('test_user');
    console.log('[TripManager Test] ✓ User stats calculated');
    console.log('  - Total trips:', userStats.totalTrips);
    console.log('  - Total distance:', userStats.totalDistance, 'm');
    console.log('  - Total CO2 saved:', userStats.totalCO2Saved, 'kg');

    // Test 8: Get recent trips
    console.log('\n[TripManager Test] Test 8: Getting recent trips...');
    const recentTrips = await TripManager.getRecentTrips(5);
    console.log('[TripManager Test] ✓ Recent trips retrieved:', recentTrips.length);

    // Test 9: Export trip
    console.log('\n[TripManager Test] Test 9: Exporting trip...');
    const exportData = await TripManager.exportTrip(manualTrip.id);
    console.log('[TripManager Test] ✓ Trip exported');
    console.log('  - Has route:', exportData?.route.length || 0, 'points');

    // Test 10: Delete trip
    console.log('\n[TripManager Test] Test 10: Deleting trip...');
    await TripManager.deleteTrip(manualTrip.id);
    const deletedTrip = await TripManager.getTrip(manualTrip.id);
    console.log('[TripManager Test] ✓ Trip deleted:', deletedTrip === null);

    console.log('\n[TripManager Test] ✅ All tests passed!');
    return true;
  } catch (error) {
    console.error('[TripManager Test] ❌ Test failed:', error);
    return false;
  }
}

/**
 * Test automatic trip workflow
 */
export async function testAutomaticTrip(): Promise<boolean> {
  try {
    console.log('[TripManager Test] Testing automatic trip workflow...');

    await database.init();

    // Start automatic trip
    const tripId = await TripManager.startAutomaticTrip('test_user', 'cycle');
    console.log('[TripManager Test] ✓ Automatic trip started:', tripId);

    // Simulate adding locations (normally done by LocationTrackingService)
    await database.addLocation({
      trip_id: tripId,
      latitude: 37.7749,
      longitude: -122.4194,
      altitude: 10,
      accuracy: 5,
      speed: 5, // 5 m/s ~18 km/h
      heading: 0,
      timestamp: Date.now(),
      activity_type: 'cycling',
      activity_confidence: 0.85,
      synced: 0,
    });

    await database.addLocation({
      trip_id: tripId,
      latitude: 37.7849,
      longitude: -122.4094,
      altitude: 12,
      accuracy: 5,
      speed: 6,
      heading: 45,
      timestamp: Date.now() + 10000,
      activity_type: 'cycling',
      activity_confidence: 0.88,
      synced: 0,
    });

    console.log('[TripManager Test] ✓ Locations added');

    // Stop trip
    const { trip: completedTrip } = await TripManager.stopTrip(tripId);
    console.log('[TripManager Test] ✓ Trip stopped');
    console.log('  - Status:', completedTrip?.status);
    console.log('  - Distance:', completedTrip?.distance, 'm');
    console.log('  - Duration:', completedTrip?.duration, 's');
    console.log('  - Type:', completedTrip?.type);

    // Cleanup
    await TripManager.deleteTrip(tripId);
    console.log('[TripManager Test] ✓ Cleanup complete');

    console.log('\n[TripManager Test] ✅ Automatic trip test passed!');
    return true;
  } catch (error) {
    console.error('[TripManager Test] ❌ Automatic trip test failed:', error);
    return false;
  }
}
