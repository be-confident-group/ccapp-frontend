/**
 * Debug Tracking Screen
 * Shows real-time tracking status for testing without console access
 */

import { View, Text, ScrollView, StyleSheet, RefreshControl, Pressable } from 'react-native';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { LocationTrackingService } from '@/lib/services/LocationTrackingService';
import { TripDetectionService } from '@/lib/services/TripDetectionService';
import { database } from '@/lib/database';
import { useTheme } from '@/contexts/ThemeContext';
import * as TaskManager from 'expo-task-manager';

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
    locationsCount: number;
  } | null;
  lastLocation: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    speed: number | null;
    timestamp: string;
  } | null;
  detectionConfig: {
    minSpeed: string;
    minDuration: string;
    minDistance: string;
    accuracyThreshold: string;
  };
  databaseStats: {
    totalTrips: number;
    unsyncedTrips: number;
    totalLocations: number;
  };
}

export default function DebugTrackingScreen() {
  const { colors } = useTheme();
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          locationsCount: locations.length,
        };
      }

      // Get last location from database
      let lastLocationInfo = null;
      if (activeTrip) {
        const locations = await database.getLocationsByTrip(activeTrip.id);
        if (locations.length > 0) {
          const last = locations[locations.length - 1];
          lastLocationInfo = {
            latitude: last.latitude,
            longitude: last.longitude,
            accuracy: last.accuracy,
            speed: last.speed,
            timestamp: new Date(last.timestamp).toLocaleTimeString(),
          };
        }
      }

      // Get detection config
      const config = TripDetectionService.getConfig();
      const detectionConfig = {
        minSpeed: `${(config.movementSpeedThreshold * 3.6).toFixed(1)} km/h`,
        minDuration: `${config.minTripDuration}s`,
        minDistance: `${config.minTripDistance}m`,
        accuracyThreshold: '100m',
      };

      // Get database stats
      const allTrips = await database.getAllTrips();
      const unsyncedTrips = allTrips.filter((t) => t.synced === 0);
      let totalLocations = 0;
      for (const trip of allTrips) {
        const locs = await database.getLocationsByTrip(trip.id);
        totalLocations += locs.length;
      }

      const databaseStats = {
        totalTrips: allTrips.length,
        unsyncedTrips: unsyncedTrips.length,
        totalLocations,
      };

      setDebugInfo({
        timestamp: new Date().toLocaleTimeString(),
        isTracking,
        taskRegistered,
        permissions: {
          foreground: permissions.foreground,
          background: permissions.background,
        },
        activeTrip: activeTripInfo,
        lastLocation: lastLocationInfo,
        detectionConfig,
        databaseStats,
      });
    } catch (err) {
      console.error('[DebugTracking] Error loading info:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  useEffect(() => {
    loadDebugInfo();

    // Auto-refresh every 5 seconds
    const interval = setInterval(loadDebugInfo, 5000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDebugInfo();
    setRefreshing(false);
  };

  const StatusIndicator = ({ active }: { active: boolean }) => (
    <View style={[styles.indicator, { backgroundColor: active ? '#4CAF50' : '#F44336' }]} />
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
              <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
                Updated: {debugInfo.timestamp}
              </Text>
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
                    Started: {debugInfo.activeTrip.startTime}
                  </Text>
                  <Text style={[styles.value, { color: colors.text }]}>
                    Duration: {debugInfo.activeTrip.duration}
                  </Text>
                  <Text style={[styles.value, { color: colors.text }]}>
                    Distance: {debugInfo.activeTrip.distance.toFixed(0)}m
                  </Text>
                  <Text style={[styles.value, { color: colors.text }]}>
                    Locations: {debugInfo.activeTrip.locationsCount}
                  </Text>
                </>
              ) : (
                <Text style={[styles.value, { color: colors.textSecondary }]}>No active trip</Text>
              )}
            </View>

            {/* Last Location Section */}
            <View style={[styles.section, { backgroundColor: colors.card }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Last Location</Text>
              {debugInfo.lastLocation ? (
                <>
                  <Text style={[styles.value, { color: colors.text, fontFamily: 'monospace' }]}>
                    {debugInfo.lastLocation.latitude.toFixed(6)}, {debugInfo.lastLocation.longitude.toFixed(6)}
                  </Text>
                  <Text style={[styles.value, { color: colors.text }]}>
                    Accuracy: {debugInfo.lastLocation.accuracy?.toFixed(0) || 'unknown'}m
                  </Text>
                  <Text style={[styles.value, { color: colors.text }]}>
                    Speed: {debugInfo.lastLocation.speed ?
                      `${(debugInfo.lastLocation.speed * 3.6).toFixed(1)} km/h` : 'unknown'}
                  </Text>
                  <Text style={[styles.value, { color: colors.text }]}>
                    Time: {debugInfo.lastLocation.timestamp}
                  </Text>
                </>
              ) : (
                <Text style={[styles.value, { color: colors.textSecondary }]}>No location data</Text>
              )}
            </View>

            {/* Detection Config Section */}
            <View style={[styles.section, { backgroundColor: colors.card }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Detection Config</Text>
              <Text style={[styles.value, { color: colors.text }]}>
                Min Speed: {debugInfo.detectionConfig.minSpeed}
              </Text>
              <Text style={[styles.value, { color: colors.text }]}>
                Min Duration: {debugInfo.detectionConfig.minDuration}
              </Text>
              <Text style={[styles.value, { color: colors.text }]}>
                Min Distance: {debugInfo.detectionConfig.minDistance}
              </Text>
              <Text style={[styles.value, { color: colors.text }]}>
                Accuracy Threshold: {debugInfo.detectionConfig.accuracyThreshold}
              </Text>
            </View>

            {/* Database Stats Section */}
            <View style={[styles.section, { backgroundColor: colors.card }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Database Stats</Text>
              <Text style={[styles.value, { color: colors.text }]}>
                Total Trips: {debugInfo.databaseStats.totalTrips}
              </Text>
              <Text style={[styles.value, { color: colors.text }]}>
                Unsynced Trips: {debugInfo.databaseStats.unsyncedTrips}
              </Text>
              <Text style={[styles.value, { color: colors.text }]}>
                Total Locations: {debugInfo.databaseStats.totalLocations}
              </Text>
            </View>
          </>
        )}

        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          Pull down to refresh • Auto-refreshes every 5s
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
});
