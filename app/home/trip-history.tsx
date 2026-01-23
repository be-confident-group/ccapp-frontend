/**
 * Trip History Screen
 *
 * Displays list of all trips with filters
 */

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useUnits } from '@/contexts/UnitsContext';
import { database, type Trip as DBTrip } from '@/lib/database';
import { formatDistance as formatDistanceUtil, formatDuration } from '@/lib/utils/geoCalculations';
import { getTripTypeColor, getTripTypeIcon, getTripTypeName } from '@/types/trip';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, TouchableOpacity, View, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ChevronLeftIcon, CloudIcon } from 'react-native-heroicons/outline';
import { syncService } from '@/lib/services/SyncService';
import { useNetworkStatus } from '@/lib/hooks/useNetworkStatus';
import { RatedBadge } from '@/components/rating';
import { useTrips } from '@/lib/hooks/useTrips';
import type { ApiTrip } from '@/lib/api/trips';

// Unified trip display type for both local and backend trips
interface DisplayTrip {
  id: string;
  backendId?: number;
  type: 'walk' | 'run' | 'cycle' | 'drive';
  isManual: boolean;
  startTime: Date;
  distance: number; // meters
  duration: number; // seconds
  co2Saved: number; // kg
  isSynced: boolean;
  hasRoute: boolean;
  clientId: string;
}

export default function TripHistoryScreen() {
  const { colors } = useTheme();
  const { unitSystem, formatWeight } = useUnits();

  // Fetch trips from backend API
  const { data: backendTrips, isLoading, refetch, isRefetching } = useTrips({ status: 'completed' });

  const [syncing, setSyncing] = useState(false);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [ratedTripIds, setRatedTripIds] = useState<Set<string>>(new Set());
  const [localTrips, setLocalTrips] = useState<DBTrip[]>([]);
  const [localLoading, setLocalLoading] = useState(true);
  const { isOnline } = useNetworkStatus();

  // Determine which data source to use
  const useLocalData = !isOnline || (!backendTrips && localTrips.length > 0);

  useEffect(() => {
    loadLocalData();
  }, []);

  async function loadLocalData() {
    try {
      setLocalLoading(true);
      await database.init();

      // Get unsynced count from local database
      const unsynced = await syncService.getUnsyncedCount();
      setUnsyncedCount(unsynced);

      // Get all ratings to determine which trips are rated
      const ratings = await database.getAllRatings();
      const ratedIds = new Set(ratings.map((r) => r.trip_id));
      setRatedTripIds(ratedIds);

      // Load local trips for offline display
      const trips = await database.getAllTrips({ status: 'completed' });
      setLocalTrips(trips);
    } catch (error) {
      console.error('[TripHistory] Error loading local data:', error);
    } finally {
      setLocalLoading(false);
    }
  }

  // Convert backend trips to display format
  function backendToDisplay(trip: ApiTrip): DisplayTrip {
    return {
      id: trip.client_id,
      backendId: trip.id,
      type: trip.type,
      isManual: trip.is_manual,
      startTime: new Date(trip.start_timestamp),
      distance: trip.distance * 1000, // km to meters
      duration: trip.duration,
      co2Saved: trip.co2_saved,
      isSynced: true,
      hasRoute: (trip.route && trip.route.length > 0) || false,
      clientId: trip.client_id,
    };
  }

  // Convert local trips to display format
  function localToDisplay(trip: DBTrip): DisplayTrip {
    return {
      id: trip.id,
      backendId: trip.backend_id || undefined,
      type: trip.type,
      isManual: trip.is_manual === 1,
      startTime: new Date(trip.start_time),
      distance: trip.distance, // already in meters
      duration: trip.duration,
      co2Saved: trip.co2_saved,
      isSynced: trip.synced === 1,
      hasRoute: !!trip.route_data,
      clientId: trip.id,
    };
  }

  // Get the display trips based on data source and filter out run/drive trips
  const displayTrips: DisplayTrip[] = (useLocalData
    ? localTrips.map(localToDisplay)
    : (backendTrips || []).map(backendToDisplay)
  ).filter(trip => trip.type === 'walk' || trip.type === 'cycle');

  async function onRefresh() {
    await Promise.all([
      refetch(),
      loadLocalData(),
    ]);
  }

  async function handleSyncAll() {
    if (!isOnline) {
      Alert.alert('No Internet', 'Please check your internet connection and try again.');
      return;
    }

    if (syncing) return;

    setSyncing(true);
    try {
      const result = await syncService.syncTrips();

      if (result.success) {
        Alert.alert(
          'Sync Complete',
          `Successfully synced ${result.syncedCount} trip${result.syncedCount !== 1 ? 's' : ''}.${
            result.failedCount > 0 ? `\n${result.failedCount !== 1 ? 's' : ''} failed to sync.` : ''
          }`
        );
        await Promise.all([refetch(), loadLocalData()]); // Reload to update sync status
      } else {
        Alert.alert('Sync Failed', 'Failed to sync trips. Please try again.');
      }
    } catch (error) {
      console.error('[TripHistory] Sync error:', error);
      Alert.alert('Sync Error', error instanceof Error ? error.message : 'An error occurred while syncing.');
    } finally {
      setSyncing(false);
    }
  }

  function renderTrip({ item }: { item: DisplayTrip }) {
    const tripColor = getTripTypeColor(item.type);
    const tripIcon = getTripTypeIcon(item.type);
    const tripName = getTripTypeName(item.type);
    const isRated = ratedTripIds.has(item.clientId);

    // Navigate to trip detail - use backend ID if available, otherwise local ID
    const handlePress = () => {
      if (item.backendId) {
        router.push(`/home/trip-detail?id=${item.backendId}`);
      } else {
        // For unsynced trips, show local trip detail (or alert if not implemented)
        Alert.alert('Trip Not Synced', 'This trip has not been synced to the server yet. Sync to view full details.');
      }
    };

    return (
      <TouchableOpacity
        style={[styles.tripCard, { backgroundColor: colors.card }]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        {/* Icon */}
        <View style={[styles.tripIcon, { backgroundColor: tripColor + '20' }]}>
          <MaterialCommunityIcons name={tripIcon as any} size={24} color={tripColor} />
        </View>

        {/* Details */}
        <View style={styles.tripDetails}>
          <View style={styles.tripHeader}>
            <ThemedText style={styles.tripType}>{tripName}</ThemedText>
            {item.isManual && (
              <View style={[styles.manualBadge, { backgroundColor: colors.border }]}>
                <ThemedText style={styles.manualText}>Manual</ThemedText>
              </View>
            )}
            {/* Sync Status Badge */}
            <View style={[styles.syncBadge, { backgroundColor: item.isSynced ? '#4CAF50' : '#FF9800' }]}>
              <MaterialCommunityIcons
                name={item.isSynced ? 'cloud-check' : 'cloud-upload'}
                size={14}
                color="#FFFFFF"
              />
            </View>
            {/* Rating Badge - only show for trips with route data */}
            {item.hasRoute && (
              <RatedBadge isRated={isRated} size="small" style={styles.ratedBadge} />
            )}
          </View>

          <ThemedText style={[styles.tripDate, { color: colors.textSecondary }]}>
            {item.startTime.toLocaleDateString()} at {item.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </ThemedText>

          <View style={styles.tripStats}>
            <View style={styles.stat}>
              <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>Distance</ThemedText>
              <ThemedText style={styles.statValue}>{formatDistanceUtil(item.distance, unitSystem)}</ThemedText>
            </View>

            <View style={styles.stat}>
              <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>Duration</ThemedText>
              <ThemedText style={styles.statValue}>{formatDuration(item.duration)}</ThemedText>
            </View>

            <View style={styles.stat}>
              <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>CO₂</ThemedText>
              <ThemedText style={styles.statValue}>{formatWeight(item.co2Saved)}</ThemedText>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  // Show loading only if both sources are loading
  if (isLoading && localLoading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
        <ThemedView style={styles.container}>
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        </ThemedView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <ThemedView style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ChevronLeftIcon size={28} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <ThemedText type="subtitle" style={styles.headerTitle}>
              Trip History
            </ThemedText>
            {unsyncedCount > 0 && (
              <View style={[styles.unsyncedBadge, { backgroundColor: colors.primary }]}>
                <ThemedText style={styles.unsyncedText}>{unsyncedCount}</ThemedText>
              </View>
            )}
          </View>

          {/* Sync Button */}
          {unsyncedCount > 0 && (
            <TouchableOpacity
              style={styles.syncButton}
              onPress={handleSyncAll}
              disabled={syncing || !isOnline}
              activeOpacity={0.7}
            >
              {syncing ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <MaterialCommunityIcons
                  name="cloud-sync"
                  size={24}
                  color={isOnline ? colors.primary : colors.textSecondary}
                />
              )}
            </TouchableOpacity>
          )}

          {unsyncedCount === 0 && <View style={styles.placeholder} />}
        </View>

      {/* Offline Banner */}
      {useLocalData && (
        <View style={[styles.offlineBanner, { backgroundColor: colors.border }]}>
          <CloudIcon size={16} color={colors.textSecondary} />
          <ThemedText style={[styles.offlineText, { color: colors.textSecondary }]}>
            {isOnline ? 'Showing local data' : 'Offline - showing local trips'}
          </ThemedText>
        </View>
      )}

      {displayTrips.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="map-marker-off" size={64} color={colors.textSecondary} />
          <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
            No trips yet
          </ThemedText>
          <ThemedText style={[styles.emptySubtext, { color: colors.textSecondary }]}>
            Enable background tracking or add a manual entry
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={displayTrips}
          renderItem={renderTrip}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        />
      )}
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  unsyncedBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unsyncedText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  syncButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    width: 40,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  offlineText: {
    fontSize: 13,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 16,
  },
  tripCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tripIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  tripDetails: {
    flex: 1,
  },
  tripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  tripType: {
    fontSize: 18,
    fontWeight: '600',
  },
  manualBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  manualText: {
    fontSize: 11,
    fontWeight: '500',
  },
  syncBadge: {
    marginLeft: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratedBadge: {
    marginLeft: 8,
  },
  tripDate: {
    fontSize: 13,
    marginBottom: 8,
  },
  tripStats: {
    flexDirection: 'row',
    gap: 16,
  },
  stat: {
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});
