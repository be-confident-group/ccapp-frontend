/**
 * All Trips Review Screen
 *
 * Shows completed trips with options to confirm or flag them.
 * By default hides system-flagged trips (is_valid=false, unconfirmed) to reduce noise.
 * A toggle reveals them. Multi-select mode enables bulk Delete and "Not my trip".
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
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ChevronLeftIcon, FunnelIcon } from 'react-native-heroicons/outline';
import { useTrips } from '@/lib/hooks/useTrips';
import { tripAPI, type ApiTrip } from '@/lib/api/trips';

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

  const { data: backendTrips, isLoading, refetch, isRefetching } = useTrips({ status: 'completed' });

  const [localTrips, setLocalTrips] = useState<DBTrip[]>([]);
  const [localLoading, setLocalLoading] = useState(true);
  const [cachedBackendTrips, setCachedBackendTrips] = useState<ApiTrip[] | null>(null);

  // B.9: Hide system-flagged trips by default; user can reveal with toggle.
  const [showFlagged, setShowFlagged] = useState(false);

  // Phase D: Multi-select state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatching, setIsBatching] = useState(false);

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

  const allDisplayTrips: DisplayTrip[] = useMemo(() => {
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

  // B.9: Apply flagged-trips filter.
  const displayTrips = useMemo(() => {
    if (showFlagged) return allDisplayTrips;
    // Hide trips the system flagged as invalid and the user hasn't acted on yet.
    return allDisplayTrips.filter(t => !(t.isValid === false && t.userConfirmed === null));
  }, [allDisplayTrips, showFlagged]);

  const flaggedCount = useMemo(
    () => allDisplayTrips.filter(t => t.isValid === false && t.userConfirmed === null).length,
    [allDisplayTrips],
  );

  // Phase D: Selection helpers
  function enterSelectionMode(firstId?: string) {
    setSelectionMode(true);
    setSelectedIds(new Set(firstId ? [firstId] : []));
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  function toggleSelection(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(displayTrips.map(t => t.id)));
  }

  async function handleBatchDelete() {
    const ids = [...selectedIds];
    const backendIds = displayTrips
      .filter(t => ids.includes(t.id) && t.backendId != null)
      .map(t => t.backendId!);

    Alert.alert(
      `Delete ${ids.length} trip${ids.length !== 1 ? 's' : ''}?`,
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsBatching(true);
            try {
              // Optimistic: remove from local state immediately
              setLocalTrips(prev => prev.filter(t => !ids.includes(t.id)));
              exitSelectionMode();

              if (backendIds.length > 0) {
                const result = await tripAPI.batchDelete(backendIds);
                if (result.failed.length > 0) {
                  Alert.alert(
                    'Partial failure',
                    `Deleted ${result.deleted.length} of ${backendIds.length} trips. ${result.failed.length} failed.`,
                  );
                }
              }
              await Promise.all([refetch(), loadLocalData()]);
            } catch {
              Alert.alert('Error', 'Could not delete trips. Please try again.');
              await loadLocalData();
            } finally {
              setIsBatching(false);
            }
          },
        },
      ],
    );
  }

  async function handleBatchNotMyTrip() {
    const ids = [...selectedIds];
    const backendIds = displayTrips
      .filter(t => ids.includes(t.id) && t.backendId != null)
      .map(t => t.backendId!);

    Alert.alert(
      `Not your trips?`,
      `Mark ${ids.length} trip${ids.length !== 1 ? 's' : ''} as not yours? They'll move out of your review queue.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: "Not my trip",
          style: 'destructive',
          onPress: async () => {
            setIsBatching(true);
            try {
              exitSelectionMode();
              if (backendIds.length > 0) {
                const result = await tripAPI.batchUpdate(backendIds, { user_confirmed: false });
                if (result.failed.length > 0) {
                  Alert.alert(
                    'Partial failure',
                    `Updated ${result.updated.length} of ${backendIds.length} trips.`,
                  );
                }
              }
              await Promise.all([refetch(), loadLocalData()]);
            } catch {
              Alert.alert('Error', 'Could not update trips. Please try again.');
            } finally {
              setIsBatching(false);
            }
          },
        },
      ],
    );
  }

  function renderTrip({ item }: { item: DisplayTrip }) {
    const tripColor = getTripTypeColor(item.type);
    const tripIcon = getTripTypeIcon(item.type);
    const tripName = getTripTypeName(item.type);
    const isSelected = selectedIds.has(item.id);

    const handlePress = () => {
      if (selectionMode) {
        toggleSelection(item.id);
        return;
      }
      if (item.backendId) {
        router.push(`/home/trip-detail?id=${item.backendId}`);
      } else {
        router.push(`/home/trip-detail?id=${item.id}&local=true`);
      }
    };

    const handleLongPress = () => {
      if (!selectionMode) enterSelectionMode(item.id);
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
      <View style={[styles.tripCard, { backgroundColor: isSelected ? colors.primary + '18' : colors.card, borderColor: isSelected ? colors.primary : 'transparent', borderWidth: 1 }]}>
        {selectionMode && (
          <View style={styles.checkboxContainer}>
            <View style={[styles.checkbox, { borderColor: colors.primary, backgroundColor: isSelected ? colors.primary : 'transparent' }]}>
              {isSelected && <MaterialCommunityIcons name="check" size={14} color="#fff" />}
            </View>
          </View>
        )}
        <TouchableOpacity
          style={[styles.tripCardTappable, selectionMode && { paddingLeft: 44 }]}
          onPress={handlePress}
          onLongPress={handleLongPress}
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

  // Only count synced trips that the user hasn't confirmed (exclude system-flagged invalid ones).
  const unconfirmedCount = allDisplayTrips.filter(
    t => t.isSynced && t.userConfirmed === null && t.isValid !== false
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
          {selectionMode ? (
            <>
              <TouchableOpacity style={styles.backButton} onPress={exitSelectionMode} activeOpacity={0.7}>
                <ThemedText style={{ color: colors.primary }}>Cancel</ThemedText>
              </TouchableOpacity>
              <ThemedText type="subtitle" style={styles.headerTitle}>
                {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select trips'}
              </ThemedText>
              <TouchableOpacity style={styles.backButton} onPress={selectedIds.size === displayTrips.length ? () => setSelectedIds(new Set()) : selectAll} activeOpacity={0.7}>
                <ThemedText style={{ color: colors.primary, fontSize: 13 }}>
                  {selectedIds.size === displayTrips.length ? 'Deselect all' : 'Select all'}
                </ThemedText>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
                <ChevronLeftIcon size={28} color={colors.text} />
              </TouchableOpacity>
              <View style={styles.headerCenter}>
                <ThemedText type="subtitle" style={styles.headerTitle}>All Trips</ThemedText>
                {unconfirmedCount > 0 && (
                  <View style={[styles.unconfirmedBadge, { backgroundColor: '#FF5722' }]}>
                    <ThemedText style={styles.badgeCountText}>{unconfirmedCount}</ThemedText>
                  </View>
                )}
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {flaggedCount > 0 && (
                  <TouchableOpacity style={styles.backButton} onPress={() => setShowFlagged(v => !v)} activeOpacity={0.7}>
                    <FunnelIcon size={22} color={showFlagged ? colors.primary : colors.textSecondary} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.backButton} onPress={() => enterSelectionMode()} activeOpacity={0.7}>
                  <ThemedText style={{ color: colors.primary, fontSize: 13 }}>Select</ThemedText>
                </TouchableOpacity>
              </View>
            </>
          )}
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
        {!showFlagged && flaggedCount > 0 && (
          <TouchableOpacity
            style={[styles.flaggedBanner, { backgroundColor: colors.card }]}
            onPress={() => setShowFlagged(true)}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="filter-outline" size={16} color={colors.textSecondary} />
            <ThemedText style={[styles.flaggedBannerText, { color: colors.textSecondary }]}>
              {flaggedCount} flagged trip{flaggedCount !== 1 ? 's' : ''} hidden — tap to show
            </ThemedText>
          </TouchableOpacity>
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
        {/* Batch action bar — shown when items are selected */}
        {selectionMode && selectedIds.size > 0 && (
          <View style={[styles.actionBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.actionBarButton, { backgroundColor: '#FF5722' + '20' }]}
              onPress={handleBatchDelete}
              disabled={isBatching}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="trash-can-outline" size={20} color="#FF5722" />
              <ThemedText style={[styles.actionBarButtonText, { color: '#FF5722' }]}>
                Delete ({selectedIds.size})
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBarButton, { backgroundColor: colors.border }]}
              onPress={handleBatchNotMyTrip}
              disabled={isBatching}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="close-circle-outline" size={20} color={colors.textSecondary} />
              <ThemedText style={[styles.actionBarButtonText, { color: colors.textSecondary }]}>
                Not my trip ({selectedIds.size})
              </ThemedText>
            </TouchableOpacity>
          </View>
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
  checkboxContainer: {
    position: 'absolute',
    top: 16,
    left: 12,
    zIndex: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBar: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
  },
  actionBarButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  actionBarButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  flaggedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  flaggedBannerText: {
    fontSize: 13,
  },
});
