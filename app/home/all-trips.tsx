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
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
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
import { useTrips, useUpdateTrip } from '@/lib/hooks/useTrips';
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
  const updateTrip = useUpdateTrip();

  const [localTrips, setLocalTrips] = useState<DBTrip[]>([]);
  const [localLoading, setLocalLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

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

  useFocusEffect(
    useCallback(() => {
      loadLocalData();
    }, [loadLocalData])
  );

  const displayTrips: DisplayTrip[] = useMemo(() => {
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

    if (!backendTrips) {
      return localTrips
        .map(localToDisplay)
        .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
    }

    const syncedClientIds = new Set(backendTrips.map(t => t.client_id));
    const unsyncedLocalTrips = localTrips.filter(
      t => t.synced !== 1 && !syncedClientIds.has(t.id)
    );

    return [
      ...backendTrips.map(backendToDisplay),
      ...unsyncedLocalTrips.map(localToDisplay),
    ].sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }, [backendTrips, localTrips]);

  async function handleConfirm(tripId: number) {
    setConfirmingId(tripId);
    try {
      await updateTrip.mutateAsync({ id: tripId, data: { user_confirmed: true } });
    } catch (error) {
      console.error('[AllTrips] Error confirming trip:', error);
    } finally {
      setConfirmingId(null);
    }
  }

  async function handleFlag(tripId: number) {
    setConfirmingId(tripId);
    try {
      await updateTrip.mutateAsync({ id: tripId, data: { user_confirmed: false } });
    } catch (error) {
      console.error('[AllTrips] Error flagging trip:', error);
    } finally {
      setConfirmingId(null);
    }
  }

  function renderTrip({ item }: { item: DisplayTrip }) {
    const tripColor = getTripTypeColor(item.type);
    const tripIcon = getTripTypeIcon(item.type);
    const tripName = getTripTypeName(item.type);
    const isProcessing = item.backendId ? confirmingId === item.backendId : false;

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
      <TouchableOpacity
        style={[styles.tripCard, { backgroundColor: colors.card }]}
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

          {/* Confirmation banner — only when synced and not yet reviewed */}
          {/* Wrapped in TouchableOpacity with empty onPress to consume the press event
              and prevent it from bubbling up to the parent card's navigation handler */}
          {item.isSynced && item.backendId && item.userConfirmed === null && (
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => {}}
              style={[styles.confirmBanner, { backgroundColor: colors.background, borderColor: colors.border }]}
            >
              <ThemedText style={[styles.confirmQuestion, { color: colors.textSecondary }]}>
                Was this trip accurate?
              </ThemedText>
              <View style={styles.confirmButtons}>
                {isProcessing ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <TouchableOpacity
                      style={[styles.confirmBtn, { backgroundColor: '#4CAF50' + '20', borderColor: '#4CAF50' }]}
                      onPress={() => handleConfirm(item.backendId!)}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons name="check" size={14} color="#4CAF50" />
                      <ThemedText style={[styles.confirmBtnText, { color: '#4CAF50' }]}>Yes, this was me</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.confirmBtn, { backgroundColor: '#FF5722' + '20', borderColor: '#FF5722' }]}
                      onPress={() => handleFlag(item.backendId!)}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons name="close" size={14} color="#FF5722" />
                      <ThemedText style={[styles.confirmBtnText, { color: '#FF5722' }]}>Not accurate</ThemedText>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </TouchableOpacity>
          )}

          {/* Unsynced trips: prompt to sync */}
          {!item.isSynced && (
            <View style={[styles.confirmBanner, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <ThemedText style={[styles.confirmQuestion, { color: colors.textSecondary }]}>
                Sync this trip to confirm or flag it
              </ThemedText>
            </View>
          )}
        </View>
      </TouchableOpacity>
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
          <View style={[styles.reviewBanner, { backgroundColor: '#FF5722' + '15', borderColor: '#FF5722' + '40' }]}>
            <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#FF5722" />
            <ThemedText style={[styles.reviewBannerText, { color: '#FF5722' }]}>
              {unconfirmedCount} trip{unconfirmedCount !== 1 ? 's' : ''} need your review
            </ThemedText>
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
  reviewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  reviewBannerText: {
    fontSize: 13,
    fontWeight: '500',
  },
  list: { padding: 16 },
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
  confirmBanner: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  confirmQuestion: {
    fontSize: 13,
    marginBottom: 8,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  confirmBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  confirmBtnText: {
    fontSize: 12,
    fontWeight: '600',
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
