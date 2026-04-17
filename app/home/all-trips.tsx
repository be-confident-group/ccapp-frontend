/**
 * All Trips Review Screen
 *
 * Shows ALL completed trips (no is_valid filter) so users can
 * confirm accurate trips or flag inaccurate ones.
 */

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useUnits } from '@/contexts/UnitsContext';
import { database, type Trip as DBTrip } from '@/lib/database';
import { formatDistance as formatDistanceUtil, formatDuration } from '@/lib/utils/geoCalculations';
import { getTripTypeColor, getTripTypeIcon, getTripTypeName } from '@/types/trip';
import { isVisibleTripType } from '@/lib/utils/tripTypeUi';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ChevronLeftIcon } from 'react-native-heroicons/outline';
import { useTrips } from '@/lib/hooks/useTrips';
import type { ApiTrip } from '@/lib/api/trips';

interface DisplayTrip {
  id: string;
  backendId?: number;
  type: 'walk' | 'run' | 'cycle' | 'drive';
  isManual: boolean;
  startTime: Date;
  distance: number; // meters
  duration: number; // seconds
  isSynced: boolean;
  isValid: boolean | null;
  userConfirmed: boolean | null;
}

export default function AllTripsScreen() {
  const { colors } = useTheme();
  const { unitSystem } = useUnits();

  // Fetch ALL trips from backend (no is_valid filter — we want to see everything)
  const { data: backendTrips, isLoading, refetch, isRefetching } = useTrips({ status: 'completed' });

  const [localTrips, setLocalTrips] = useState<DBTrip[]>([]);
  const [localLoading, setLocalLoading] = useState(true);
  // Cached backend trips for offline use — populated from AsyncStorage when backend unavailable
  const [cachedBackendTrips, setCachedBackendTrips] = useState<ApiTrip[] | null>(null);

  const TRIPS_CACHE_KEY = '@all_trips_cache';

  const loadLocalData = useCallback(async () => {
    try {
      setLocalLoading(true);
      await database.init();
      const trips = await database.getAllTrips({ status: 'completed' });
      setLocalTrips(trips);
    } catch (error) {
      console.error('[AllTrips] Error loading local data:', error);
    } finally {
      setLocalLoading(false);
    }
  }, []);

  // Load cached backend trips from AsyncStorage on mount (for offline fallback)
  useEffect(() => {
    AsyncStorage.getItem(TRIPS_CACHE_KEY)
      .then(raw => {
        if (raw) setCachedBackendTrips(JSON.parse(raw));
      })
      .catch(() => {});
  }, []);

  // Persist backend trips to AsyncStorage whenever a fresh fetch succeeds
  useEffect(() => {
    if (backendTrips) {
      AsyncStorage.setItem(TRIPS_CACHE_KEY, JSON.stringify(backendTrips)).catch(() => {});
    }
  }, [backendTrips]);

  useFocusEffect(
    useCallback(() => {
      loadLocalData();
    }, [loadLocalData])
  );

  const displayTrips: DisplayTrip[] = useMemo(() => {
    // Use live data when online, fall back to AsyncStorage cache when offline
    const resolvedBackendTrips = backendTrips ?? cachedBackendTrips ?? null;

    function backendToDisplay(trip: ApiTrip): DisplayTrip {
      return {
        id: trip.client_id,
        backendId: trip.id,
        type: trip.type,
        isManual: trip.is_manual,
        startTime: new Date(trip.start_timestamp),
        distance: trip.distance * 1000, // km → meters
        duration: trip.duration,
        isSynced: true,
        isValid: trip.is_valid,
        userConfirmed: trip.user_confirmed,
      };
    }

    function localToDisplay(trip: DBTrip): DisplayTrip {
      return {
        id: trip.id,
        type: trip.type,
        isManual: trip.is_manual === 1,
        startTime: new Date(trip.start_time),
        distance: trip.distance,
        duration: trip.duration,
        isSynced: false,
        isValid: null,
        userConfirmed: null,
      };
    }

    if (!resolvedBackendTrips) {
      return localTrips
        .map(localToDisplay)
        .filter((t) => isVisibleTripType(t.type))
        .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
    }

    const syncedClientIds = new Set(resolvedBackendTrips.map(t => t.client_id));
    const unsyncedLocalTrips = localTrips.filter(
      t => t.synced !== 1 && !syncedClientIds.has(t.id)
    );

    return [
      ...resolvedBackendTrips.map(backendToDisplay),
      ...unsyncedLocalTrips.map(localToDisplay),
    ]
      .filter((t) => isVisibleTripType(t.type))
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }, [backendTrips, cachedBackendTrips, localTrips]);

  function renderTrip({ item }: { item: DisplayTrip }) {
    const tripColor = getTripTypeColor(item.type);
    const tripIcon = getTripTypeIcon(item.type);
    const tripName = getTripTypeName(item.type);

    const handlePress = () => {
      if (item.backendId) {
        router.push(`/home/trip-detail?id=${item.backendId}`);
      } else {
        router.push(`/home/trip-detail?id=${item.id}&local=true`);
      }
    };

    const statusBadge = () => {
      if (!item.isSynced) {
        return (
          <View style={[styles.badge, { backgroundColor: '#FF9800' + '30' }]}>
            <ThemedText style={[styles.badgeText, { color: '#FF9800' }]}>Not synced</ThemedText>
          </View>
        );
      }
      if (item.userConfirmed === true) {
        return (
          <View style={[styles.badge, { backgroundColor: '#4CAF50' + '30' }]}>
            <MaterialCommunityIcons name="check-circle" size={12} color="#4CAF50" />
            <ThemedText style={[styles.badgeText, { color: '#4CAF50' }]}> Confirmed</ThemedText>
          </View>
        );
      }
      if (item.userConfirmed === false) {
        return (
          <View style={[styles.badge, { backgroundColor: colors.border }]}>
            <MaterialCommunityIcons name="close-circle" size={12} color={colors.textSecondary} />
            <ThemedText style={[styles.badgeText, { color: colors.textSecondary }]}> Flagged</ThemedText>
          </View>
        );
      }
      if (item.isValid === false) {
        return (
          <View style={[styles.badge, { backgroundColor: '#FF5722' + '30' }]}>
            <MaterialCommunityIcons name="alert-circle" size={12} color="#FF5722" />
            <ThemedText style={[styles.badgeText, { color: '#FF5722' }]}> Unverified</ThemedText>
          </View>
        );
      }
      return null;
    };

    return (
      // Outer container is a plain View — no nested-touchable conflicts possible
      <View style={[styles.tripCard, { backgroundColor: colors.card }]}>
        {/* Tappable top section navigates to trip detail */}
        <TouchableOpacity
          style={styles.tripCardTappable}
          onPress={handlePress}
          activeOpacity={0.7}
        >
          <View style={[styles.tripIcon, { backgroundColor: tripColor + '20' }]}>
            <MaterialCommunityIcons name={tripIcon as any} size={24} color={tripColor} />
          </View>

          <View style={styles.tripDetails}>
            <View style={styles.tripHeader}>
              <ThemedText style={styles.tripType}>{tripName}</ThemedText>
              {statusBadge()}
            </View>

            <ThemedText style={[styles.tripDate, { color: colors.textSecondary }]}>
              {item.startTime.toLocaleDateString()} at{' '}
              {item.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </ThemedText>

            <View style={styles.tripStats}>
              <ThemedText style={[styles.statValue, { color: colors.text }]}>
                {formatDistanceUtil(item.distance, unitSystem)}
              </ThemedText>
              <ThemedText style={[styles.separator, { color: colors.textSecondary }]}> · </ThemedText>
              <ThemedText style={[styles.statValue, { color: colors.text }]}>
                {formatDuration(item.duration)}
              </ThemedText>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  const unconfirmedCount = displayTrips.filter(
    t => t.isSynced && t.userConfirmed === null
  ).length;

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
              All Trips
            </ThemedText>
            {unconfirmedCount > 0 && (
              <View style={[styles.unconfirmedBadge, { backgroundColor: '#FF5722' }]}>
                <ThemedText style={styles.badgeCountText}>{unconfirmedCount}</ThemedText>
              </View>
            )}
          </View>

          <View style={styles.placeholder} />
        </View>

        {unconfirmedCount > 0 && (
          <View style={[styles.reviewCard, { backgroundColor: colors.card }]}>
            <View style={[styles.reviewCardIcon, { backgroundColor: '#FF5722' + '20' }]}>
              <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#FF5722" />
            </View>
            <View style={styles.reviewCardContent}>
              <ThemedText style={styles.reviewCardTitle}>Trips need your review</ThemedText>
              <ThemedText style={[styles.reviewCardSub, { color: colors.textSecondary }]}>
                {unconfirmedCount} trip{unconfirmedCount !== 1 ? 's' : ''} waiting for confirmation
              </ThemedText>
            </View>
          </View>
        )}

        {displayTrips.length === 0 ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="map-marker-off" size={64} color={colors.textSecondary} />
            <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
              No trips recorded yet
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={displayTrips}
            renderItem={renderTrip}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={() => Promise.all([refetch(), loadLocalData()])}
                tintColor={colors.primary}
              />
            }
          />
        )}
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  unconfirmedBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeCountText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  placeholder: { width: 40 },
  reviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    marginBottom: 4,
    padding: 14,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    gap: 12,
  },
  reviewCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewCardContent: {
    flex: 1,
  },
  reviewCardTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  reviewCardSub: {
    fontSize: 12,
    marginTop: 2,
  },
  list: { padding: 16 },
  tripCard: {
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    overflow: 'hidden',
  },
  tripCardTappable: {
    flexDirection: 'row',
    padding: 16,
  },
  tripIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  tripDetails: { flex: 1 },
  tripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
    flexWrap: 'wrap',
  },
  tripType: {
    fontSize: 17,
    fontWeight: '600',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  tripDate: {
    fontSize: 13,
    marginBottom: 4,
  },
  tripStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  separator: {
    fontSize: 14,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
  },
});
