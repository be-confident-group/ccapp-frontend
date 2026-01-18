/**
 * Debug Tracking Screen
 * Shows real-time tracking status for testing without console access
 */

import { View, Text, ScrollView, StyleSheet, RefreshControl, Pressable, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { LocationTrackingService } from '@/lib/services/LocationTrackingService';
import { TripDetectionService } from '@/lib/services/TripDetectionService';
import { ActivityClassifier } from '@/lib/services/ActivityClassifier';
import { database } from '@/lib/database';
import { useTheme } from '@/contexts/ThemeContext';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';

interface DebugInfo {
  timestamp: string;
  isTracking: boolean;
  taskRegistered: boolean;
  permissions: {
    foreground: string;
    background: string;
  };
  activeTrip: {
    id: string;
    startTime: string;
    duration: string;
    distance: number;
    type: string;
    locationsCount: number;
  } | null;
  lastDbLocation: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    speed: number | null;
    timestamp: string;
    tripId: string;
  } | null;
  currentGpsLocation: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    speed: number | null;
    timestamp: string;
    wouldStartTrip: boolean;
    wouldStartReason: string;
  } | null;
  detectionConfig: {
    minSpeed: string;
    minSpeedMs: number;
    minDuration: string;
    minDistance: string;
    accuracyThreshold: string;
  };
  databaseStats: {
    totalTrips: number;
    activeTrips: number;
    completedTrips: number;
    unsyncedTrips: number;
    totalLocations: number;
  };
  recentTrips: Array<{
    id: string;
    type: string;
    status: string;
    distance: number;
    duration: number;
    locationsCount: number;
    startTime: string;
  }>;
  lastCompletedTrip?: {
    id: string;
    status: string;
    distance: number;
    duration: number;
    locationsCount: number;
    hasRouteData: boolean;
    routeDataLength: number;
    routeDataSample: string | null;
  };
}

export default function DebugTrackingScreen() {
  const { colors } = useTheme();
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testingGps, setTestingGps] = useState(false);
  const [gpsTestResult, setGpsTestResult] = useState<string | null>(null);

  const loadDebugInfo = async () => {
    try {
      setError(null);

      // Check tracking status
      const isTracking = await LocationTrackingService.isTracking();
      const taskRegistered = await TaskManager.isTaskRegisteredAsync('background-location-task');

      // Check permissions
      const permissions = await LocationTrackingService.checkPermissions();

      // Get active trip
      const activeTrip = await database.getActiveTrip();
      let activeTripInfo = null;
      let lastDbLocationInfo = null;

      if (activeTrip) {
        const locations = await database.getLocationsByTrip(activeTrip.id);
        const duration = Date.now() - activeTrip.start_time;
        const durationMin = Math.floor(duration / 60000);
        const durationSec = Math.floor((duration % 60000) / 1000);

        activeTripInfo = {
          id: activeTrip.id,
          startTime: new Date(activeTrip.start_time).toLocaleTimeString(),
          duration: `${durationMin}m ${durationSec}s`,
          distance: activeTrip.distance || 0,
          type: activeTrip.type || 'unknown',
          locationsCount: locations.length,
        };

        if (locations.length > 0) {
          const last = locations[locations.length - 1];
          lastDbLocationInfo = {
            latitude: last.latitude,
            longitude: last.longitude,
            accuracy: last.accuracy,
            speed: last.speed,
            timestamp: new Date(last.timestamp).toLocaleTimeString(),
            tripId: last.trip_id,
          };
        }
      }

      // If no active trip, still try to get last location from any trip
      if (!lastDbLocationInfo) {
        const allTrips = await database.getAllTrips();
        for (const trip of allTrips.slice(-5).reverse()) {
          const locations = await database.getLocationsByTrip(trip.id);
          if (locations.length > 0) {
            const last = locations[locations.length - 1];
            lastDbLocationInfo = {
              latitude: last.latitude,
              longitude: last.longitude,
              accuracy: last.accuracy,
              speed: last.speed,
              timestamp: new Date(last.timestamp).toLocaleTimeString(),
              tripId: last.trip_id,
            };
            break;
          }
        }
      }

      // Get current GPS location (manual check)
      let currentGpsInfo = null;
      try {
        const currentLoc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        // iOS returns -1 for speed when unavailable
        const rawSpeed = currentLoc.coords.speed;
        const speed = rawSpeed != null && rawSpeed >= 0 ? rawSpeed : 0;
        const speedKmh = speed * 3.6;
        const config = TripDetectionService.getConfig();
        const wouldStart = TripDetectionService.shouldStartTrip(speed);

        let reason = '';
        if (rawSpeed != null && rawSpeed < 0) {
          reason = `Speed unavailable (iOS returned ${rawSpeed})`;
        } else if (speed < config.movementSpeedThreshold) {
          reason = `Speed too low (${speedKmh.toFixed(1)} < ${(config.movementSpeedThreshold * 3.6).toFixed(1)} km/h)`;
        } else if (wouldStart) {
          reason = 'Would start trip!';
        } else {
          reason = 'Activity type not valid for trip';
        }

        currentGpsInfo = {
          latitude: currentLoc.coords.latitude,
          longitude: currentLoc.coords.longitude,
          accuracy: currentLoc.coords.accuracy,
          speed: speed, // Store normalized speed (not raw)
          timestamp: new Date(currentLoc.timestamp).toLocaleTimeString(),
          wouldStartTrip: wouldStart,
          wouldStartReason: reason,
        };
      } catch (gpsErr) {
        console.log('[DebugTracking] Could not get current GPS:', gpsErr);
      }

      // Get detection config
      const config = TripDetectionService.getConfig();
      const detectionConfig = {
        minSpeed: `${(config.movementSpeedThreshold * 3.6).toFixed(1)} km/h`,
        minSpeedMs: config.movementSpeedThreshold,
        minDuration: `${config.minTripDuration}s`,
        minDistance: `${config.minTripDistance}m`,
        accuracyThreshold: '100m',
      };

      // Get database stats
      const allTrips = await database.getAllTrips();
      const activeTrips = allTrips.filter(t => t.status === 'active');
      const completedTrips = allTrips.filter(t => t.status === 'completed');
      const unsyncedTrips = allTrips.filter(t => t.synced === 0);
      let totalLocations = 0;

      // Get recent trips with location counts
      const recentTrips: DebugInfo['recentTrips'] = [];
      for (const trip of allTrips.slice(-5).reverse()) {
        const locs = await database.getLocationsByTrip(trip.id);
        totalLocations += locs.length;
        recentTrips.push({
          id: trip.id.substring(0, 15) + '...',
          type: trip.type || 'unknown',
          status: trip.status,
          distance: trip.distance || 0,
          duration: trip.duration || 0,
          locationsCount: locs.length,
          startTime: new Date(trip.start_time).toLocaleTimeString(),
        });
      }

      const databaseStats = {
        totalTrips: allTrips.length,
        activeTrips: activeTrips.length,
        completedTrips: completedTrips.length,
        unsyncedTrips: unsyncedTrips.length,
        totalLocations,
      };

      // Get last completed trip info with route_data status
      let lastCompletedTripInfo: DebugInfo['lastCompletedTrip'] = undefined;
      if (completedTrips.length > 0) {
        // Sort by start_time descending to get the most recent
        const sortedCompleted = [...completedTrips].sort((a, b) => b.start_time - a.start_time);
        const lastTrip = sortedCompleted[0];
        const tripLocations = await database.getLocationsByTrip(lastTrip.id);

        let routeDataSample: string | null = null;
        if (lastTrip.route_data) {
          try {
            const parsed = JSON.parse(lastTrip.route_data);
            routeDataSample = JSON.stringify(parsed.slice(0, 2), null, 2);
          } catch {
            routeDataSample = 'Invalid JSON';
          }
        }

        lastCompletedTripInfo = {
          id: lastTrip.id.substring(0, 20) + '...',
          status: lastTrip.status,
          distance: lastTrip.distance || 0,
          duration: lastTrip.duration || 0,
          locationsCount: tripLocations.length,
          hasRouteData: !!lastTrip.route_data,
          routeDataLength: lastTrip.route_data?.length || 0,
          routeDataSample,
        };
      }

      setDebugInfo({
        timestamp: new Date().toLocaleTimeString(),
        isTracking,
        taskRegistered,
        permissions: {
          foreground: permissions.foreground,
          background: permissions.background,
        },
        activeTrip: activeTripInfo,
        lastDbLocation: lastDbLocationInfo,
        currentGpsLocation: currentGpsInfo,
        detectionConfig,
        databaseStats,
        recentTrips,
        lastCompletedTrip: lastCompletedTripInfo,
      });
    } catch (err) {
      console.error('[DebugTracking] Error loading info:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const testGpsNow = async () => {
    setTestingGps(true);
    setGpsTestResult(null);

    try {
      const startTime = Date.now();
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const elapsed = Date.now() - startTime;

      // iOS returns -1 for speed when unavailable
      const rawSpeed = loc.coords.speed;
      const speed = rawSpeed != null && rawSpeed >= 0 ? rawSpeed : 0;
      const speedKmh = speed * 3.6;
      const accuracy = loc.coords.accuracy || 0;

      const config = TripDetectionService.getConfig();
      const wouldStart = TripDetectionService.shouldStartTrip(speed);

      let diagnosis = [];
      diagnosis.push(`GPS responded in ${elapsed}ms`);
      diagnosis.push(`Coords: ${loc.coords.latitude.toFixed(6)}, ${loc.coords.longitude.toFixed(6)}`);
      diagnosis.push(`Accuracy: ${accuracy.toFixed(0)}m ${accuracy <= 100 ? '✓' : '✗ (>100m)'}`);

      if (rawSpeed != null && rawSpeed < 0) {
        diagnosis.push(`Speed: unavailable (iOS returned ${rawSpeed})`);
      } else {
        diagnosis.push(`Speed: ${speedKmh.toFixed(1)} km/h ${speed >= config.movementSpeedThreshold ? '✓' : `✗ (need >${(config.movementSpeedThreshold * 3.6).toFixed(1)})`}`);
      }

      diagnosis.push(`Would start trip: ${wouldStart ? 'YES ✓' : 'NO ✗'}`);

      if (!wouldStart) {
        if (rawSpeed != null && rawSpeed < 0) {
          diagnosis.push(`→ Reason: Speed unavailable from GPS`);
        } else if (speed < config.movementSpeedThreshold) {
          diagnosis.push(`→ Reason: Walking too slow or stationary`);
        } else {
          diagnosis.push(`→ Reason: Activity type check failed`);
        }
      }

      setGpsTestResult(diagnosis.join('\n'));
      await loadDebugInfo(); // Refresh all data
    } catch (err) {
      setGpsTestResult(`GPS Error: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally {
      setTestingGps(false);
    }
  };

  const forceStartTrip = async () => {
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      // iOS returns -1 for speed when unavailable
      const rawSpeed = loc.coords.speed;
      const speed = rawSpeed != null && rawSpeed >= 0 ? rawSpeed : 0;

      // Classify activity type based on speed
      const classification = ActivityClassifier.classifyBySpeed(speed);
      const tripTypeMapping: Record<string, 'walk' | 'run' | 'cycle' | 'drive'> = {
        walking: 'walk',
        running: 'run',
        cycling: 'cycle',
        driving: 'drive',
        stationary: 'walk', // Default to walk if stationary
      };
      const tripType = tripTypeMapping[classification.type] || 'walk';

      const tripId = `debug_trip_${Date.now()}`;
      await database.init();
      await database.createTrip({
        id: tripId,
        user_id: 'debug_user',
        status: 'active',
        type: tripType,
        start_time: Date.now(),
        created_at: Date.now(),
        updated_at: Date.now(),
      });

      // Add the current location
      await database.addLocation({
        trip_id: tripId,
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        altitude: loc.coords.altitude,
        accuracy: loc.coords.accuracy,
        speed: speed,
        heading: loc.coords.heading,
        timestamp: loc.timestamp,
        activity_type: classification.type,
        activity_confidence: classification.confidence,
        synced: 0,
      });

      const speedKmh = (speed * 3.6).toFixed(1);
      Alert.alert(
        'Debug Trip Started',
        `Created trip: ${tripId.substring(0, 20)}...\nType: ${tripType}\nSpeed: ${speedKmh} km/h\nLocation recorded.`
      );
      await loadDebugInfo();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  useEffect(() => {
    loadDebugInfo();

    // Auto-refresh every 3 seconds for more responsive updates
    const interval = setInterval(loadDebugInfo, 3000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDebugInfo();
    setRefreshing(false);
  };

  const StatusIndicator = ({ active, warning }: { active: boolean; warning?: boolean }) => (
    <View style={[
      styles.indicator,
      { backgroundColor: warning ? '#FF9800' : (active ? '#4CAF50' : '#F44336') }
    ]} />
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: colors.primary }]}>← Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Tracking Debug</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {error && (
          <View style={[styles.errorBox, { backgroundColor: '#FFEBEE' }]}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Test GPS Button */}
        <Pressable
          style={[styles.testButton, { backgroundColor: colors.primary }]}
          onPress={testGpsNow}
          disabled={testingGps}
        >
          <Text style={styles.testButtonText}>
            {testingGps ? 'Testing GPS...' : '📍 Test GPS Now'}
          </Text>
        </Pressable>

        {gpsTestResult && (
          <View style={[styles.section, { backgroundColor: '#E3F2FD' }]}>
            <Text style={[styles.sectionTitle, { color: '#1565C0' }]}>GPS Test Result</Text>
            <Text style={[styles.monoText, { color: '#1565C0' }]}>{gpsTestResult}</Text>
          </View>
        )}

        {/* Force Start Trip Button (for debugging) */}
        <Pressable
          style={[styles.testButton, { backgroundColor: '#FF9800', marginTop: 8 }]}
          onPress={forceStartTrip}
        >
          <Text style={styles.testButtonText}>🚀 Force Start Debug Trip</Text>
        </Pressable>

        {debugInfo && (
          <>
            {/* Status Section */}
            <View style={[styles.section, { backgroundColor: colors.card }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Status</Text>
              <View style={styles.row}>
                <StatusIndicator active={debugInfo.isTracking} />
                <Text style={[styles.label, { color: colors.text }]}>Tracking Active</Text>
              </View>
              <View style={styles.row}>
                <StatusIndicator active={debugInfo.taskRegistered} />
                <Text style={[styles.label, { color: colors.text }]}>Background Task Registered</Text>
              </View>
              <View style={styles.row}>
                <StatusIndicator active={!!debugInfo.activeTrip} warning={!debugInfo.activeTrip} />
                <Text style={[styles.label, { color: colors.text }]}>
                  Active Trip: {debugInfo.activeTrip ? 'YES' : 'NO'}
                </Text>
              </View>
              <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
                Updated: {debugInfo.timestamp}
              </Text>
            </View>

            {/* Current GPS Location (Live) */}
            <View style={[styles.section, { backgroundColor: debugInfo.currentGpsLocation?.wouldStartTrip ? '#E8F5E9' : '#FFF3E0' }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Current GPS (Live)</Text>
              {debugInfo.currentGpsLocation ? (
                <>
                  <Text style={[styles.monoText, { color: colors.text }]}>
                    {debugInfo.currentGpsLocation.latitude.toFixed(6)}, {debugInfo.currentGpsLocation.longitude.toFixed(6)}
                  </Text>
                  <Text style={[styles.value, { color: colors.text }]}>
                    Accuracy: {debugInfo.currentGpsLocation.accuracy?.toFixed(0) || '?'}m
                    {(debugInfo.currentGpsLocation.accuracy || 0) <= 100 ? ' ✓' : ' ✗ (>100m)'}
                  </Text>
                  <Text style={[styles.value, { color: colors.text, fontWeight: 'bold' }]}>
                    Speed: {debugInfo.currentGpsLocation.speed != null
                      ? `${(debugInfo.currentGpsLocation.speed * 3.6).toFixed(1)} km/h`
                      : 'unknown'}
                    {debugInfo.currentGpsLocation.speed != null && debugInfo.currentGpsLocation.speed >= debugInfo.detectionConfig.minSpeedMs ? ' ✓' : ' ✗'}
                  </Text>
                  <Text style={[styles.value, {
                    color: debugInfo.currentGpsLocation.wouldStartTrip ? '#2E7D32' : '#E65100',
                    fontWeight: 'bold'
                  }]}>
                    {debugInfo.currentGpsLocation.wouldStartReason}
                  </Text>
                </>
              ) : (
                <Text style={[styles.value, { color: colors.textSecondary }]}>Could not get GPS</Text>
              )}
            </View>

            {/* Permissions Section */}
            <View style={[styles.section, { backgroundColor: colors.card }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Permissions</Text>
              <View style={styles.row}>
                <StatusIndicator active={debugInfo.permissions.foreground === 'granted'} />
                <Text style={[styles.label, { color: colors.text }]}>
                  Foreground: {debugInfo.permissions.foreground}
                </Text>
              </View>
              <View style={styles.row}>
                <StatusIndicator active={debugInfo.permissions.background === 'granted'} />
                <Text style={[styles.label, { color: colors.text }]}>
                  Background: {debugInfo.permissions.background}
                </Text>
              </View>
            </View>

            {/* Active Trip Section */}
            <View style={[styles.section, { backgroundColor: colors.card }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Active Trip</Text>
              {debugInfo.activeTrip ? (
                <>
                  <Text style={[styles.value, { color: colors.text }]}>
                    ID: {debugInfo.activeTrip.id.substring(0, 20)}...
                  </Text>
                  <Text style={[styles.value, { color: colors.text }]}>
                    Type: {debugInfo.activeTrip.type}
                  </Text>
                  <Text style={[styles.value, { color: colors.text }]}>
                    Started: {debugInfo.activeTrip.startTime}
                  </Text>
                  <Text style={[styles.value, { color: colors.text }]}>
                    Duration: {debugInfo.activeTrip.duration}
                  </Text>
                  <Text style={[styles.value, { color: colors.text }]}>
                    Distance: {debugInfo.activeTrip.distance.toFixed(0)}m
                  </Text>
                  <Text style={[styles.value, { color: colors.text, fontWeight: 'bold' }]}>
                    Locations Recorded: {debugInfo.activeTrip.locationsCount}
                  </Text>
                </>
              ) : (
                <Text style={[styles.value, { color: '#E65100', fontWeight: 'bold' }]}>
                  No active trip - check speed threshold
                </Text>
              )}
            </View>

            {/* Last DB Location Section */}
            <View style={[styles.section, { backgroundColor: colors.card }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Last Recorded Location (DB)</Text>
              {debugInfo.lastDbLocation ? (
                <>
                  <Text style={[styles.monoText, { color: colors.text }]}>
                    {debugInfo.lastDbLocation.latitude.toFixed(6)}, {debugInfo.lastDbLocation.longitude.toFixed(6)}
                  </Text>
                  <Text style={[styles.value, { color: colors.text }]}>
                    Accuracy: {debugInfo.lastDbLocation.accuracy?.toFixed(0) || 'unknown'}m
                  </Text>
                  <Text style={[styles.value, { color: colors.text }]}>
                    Speed: {debugInfo.lastDbLocation.speed != null
                      ? `${(debugInfo.lastDbLocation.speed * 3.6).toFixed(1)} km/h`
                      : 'unknown'}
                  </Text>
                  <Text style={[styles.value, { color: colors.text }]}>
                    Time: {debugInfo.lastDbLocation.timestamp}
                  </Text>
                  <Text style={[styles.value, { color: colors.textSecondary }]}>
                    Trip: {debugInfo.lastDbLocation.tripId.substring(0, 15)}...
                  </Text>
                </>
              ) : (
                <Text style={[styles.value, { color: '#E65100', fontWeight: 'bold' }]}>
                  No locations in database!
                </Text>
              )}
            </View>

            {/* Detection Config Section */}
            <View style={[styles.section, { backgroundColor: colors.card }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Detection Config</Text>
              <Text style={[styles.value, { color: colors.text }]}>
                Min Speed to Start: {debugInfo.detectionConfig.minSpeed} ({debugInfo.detectionConfig.minSpeedMs.toFixed(2)} m/s)
              </Text>
              <Text style={[styles.value, { color: colors.text }]}>
                Min Trip Duration: {debugInfo.detectionConfig.minDuration}
              </Text>
              <Text style={[styles.value, { color: colors.text }]}>
                Min Trip Distance: {debugInfo.detectionConfig.minDistance}
              </Text>
              <Text style={[styles.value, { color: colors.text }]}>
                GPS Accuracy Threshold: {debugInfo.detectionConfig.accuracyThreshold}
              </Text>
            </View>

            {/* Database Stats Section */}
            <View style={[styles.section, { backgroundColor: colors.card }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Database Stats</Text>
              <Text style={[styles.value, { color: colors.text }]}>
                Total Trips: {debugInfo.databaseStats.totalTrips}
              </Text>
              <Text style={[styles.value, { color: colors.text }]}>
                Active Trips: {debugInfo.databaseStats.activeTrips}
              </Text>
              <Text style={[styles.value, { color: colors.text }]}>
                Completed Trips: {debugInfo.databaseStats.completedTrips}
              </Text>
              <Text style={[styles.value, { color: colors.text }]}>
                Unsynced Trips: {debugInfo.databaseStats.unsyncedTrips}
              </Text>
              <Text style={[styles.value, { color: colors.text, fontWeight: 'bold' }]}>
                Total Locations: {debugInfo.databaseStats.totalLocations}
              </Text>
            </View>

            {/* Last Completed Trip Debug Section */}
            {debugInfo.lastCompletedTrip && (
              <View style={[styles.section, { backgroundColor: colors.card }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Last Completed Trip</Text>
                <Text style={[styles.value, { color: colors.text }]}>
                  ID: {debugInfo.lastCompletedTrip.id}
                </Text>
                <Text style={[styles.value, { color: colors.text }]}>
                  Distance: {debugInfo.lastCompletedTrip.distance.toFixed(0)}m
                </Text>
                <Text style={[styles.value, { color: colors.text }]}>
                  Duration: {Math.floor(debugInfo.lastCompletedTrip.duration / 60)}m {debugInfo.lastCompletedTrip.duration % 60}s
                </Text>
                <Text style={[styles.value, { color: colors.text }]}>
                  DB Locations: {debugInfo.lastCompletedTrip.locationsCount}
                </Text>
                <Text style={[styles.value, {
                  color: debugInfo.lastCompletedTrip.hasRouteData ? '#4CAF50' : '#F44336',
                  fontWeight: 'bold'
                }]}>
                  Has route_data: {debugInfo.lastCompletedTrip.hasRouteData ? '✓ YES' : '✗ NO'}
                </Text>
                {debugInfo.lastCompletedTrip.hasRouteData && (
                  <>
                    <Text style={[styles.value, { color: colors.text }]}>
                      route_data length: {debugInfo.lastCompletedTrip.routeDataLength} chars
                    </Text>
                    <Text style={[styles.monoText, { color: colors.textSecondary, fontSize: 10 }]}>
                      Sample: {debugInfo.lastCompletedTrip.routeDataSample}
                    </Text>
                  </>
                )}
              </View>
            )}

            {/* Recent Trips Section */}
            {debugInfo.recentTrips.length > 0 && (
              <View style={[styles.section, { backgroundColor: colors.card }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Trips (Last 5)</Text>
                {debugInfo.recentTrips.map((trip, index) => (
                  <View key={index} style={styles.tripRow}>
                    <Text style={[styles.tripInfo, { color: colors.text }]}>
                      {trip.type} • {trip.status} • {trip.locationsCount} pts
                    </Text>
                    <Text style={[styles.tripDetail, { color: colors.textSecondary }]}>
                      {trip.distance.toFixed(0)}m • {Math.floor(trip.duration / 60)}m • {trip.startTime}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          Pull down to refresh • Auto-refreshes every 3s
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 60,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  errorBox: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#C62828',
    fontSize: 14,
  },
  testButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  testButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  section: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  indicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  label: {
    fontSize: 15,
  },
  value: {
    fontSize: 14,
    marginBottom: 6,
  },
  monoText: {
    fontSize: 13,
    fontFamily: 'monospace',
    marginBottom: 6,
  },
  timestamp: {
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
  },
  hint: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
  },
  tripRow: {
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tripInfo: {
    fontSize: 14,
    fontWeight: '600',
  },
  tripDetail: {
    fontSize: 12,
    marginTop: 2,
  },
});
