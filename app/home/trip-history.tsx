/**
 * Trip History Screen
 *
 * The single trips list, grouped by month. Supports in-place multi-select
 * (batch Delete / "Not my trip"), a review/flagged filter, sync and sharing.
 * All trips (including backend-flagged ones) are shown by default so recorded
 * trips are never silently hidden from the user.
 */

import { useTheme } from '@/contexts/ThemeContext';
import { useUnits } from '@/contexts/UnitsContext';
import { database, type Trip as DBTrip } from '@/lib/database';
import { formatDistance as formatDistanceUtil, formatDuration } from '@/lib/utils/geoCalculations';
import { getTripTypeName } from '@/types/trip';
import { isVisibleTripType } from '@/lib/utils/tripTypeUi';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, type FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  CheckCircleIcon,
  CloudArrowUpIcon,
  CloudIcon,
  ExclamationCircleIcon,
  MapPinIcon,
  NoSymbolIcon,
  ShareIcon,
  TrashIcon,
  XCircleIcon,
  XMarkIcon,
} from 'react-native-heroicons/outline';
import { CheckCircleIcon as CheckCircleSolidIcon } from 'react-native-heroicons/solid';
import Header from '@/components/layout/Header';
import { GlassButton } from '@/components/ui/GlassButton';
import { GlassSurface } from '@/components/ui/GlassSurface';
import { GlassTextSegments } from '@/components/ui/GlassTextSegments';
import Button from '@/components/ui/Button';
import { syncService } from '@/lib/services/SyncService';
import { useNetworkStatus } from '@/lib/hooks/useNetworkStatus';
import { RatedBadge } from '@/components/rating';
import { useTrips } from '@/lib/hooks/useTrips';
import { tripAPI, type ApiTrip } from '@/lib/api/trips';
import { ShareTripModal } from '@/components/trips/ShareTripModal';
import { TripCard } from '@/components/trips/TripCard';
import { TripChip } from '@/components/trips/TripChip';
import { TripSectionHeader } from '@/components/trips/TripSectionHeader';
import { TripsEmptyState } from '@/components/trips/TripsEmptyState';
import { buildTripRows, type TripListRow } from '@/components/trips/tripListRows';

const HEADER_HEIGHT = 56;
const ACTION_BAR_HEIGHT = 84;
const TRIPS_CACHE_KEY = '@all_trips_cache';
// Belt-and-suspenders guard: a non-manual trip with effectively zero distance is junk data
// (synthesized trip that slipped past the pedometer guard, recording starved of GPS, etc.).
// 50 m sits well below every per-type minimum so this never hides a legitimate trip.
const VISIBLE_MIN_DISTANCE_M = 50;

type TripFilter = 'all' | 'needsReview' | 'hideFlagged';

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
  isValid: boolean | null;
  userConfirmed: boolean | null;
}

function isVisibleByDistance(trip: DisplayTrip) {
  return trip.isManual || trip.distance >= VISIBLE_MIN_DISTANCE_M;
}

/** Synced trip the user hasn't acted on yet (excludes system-flagged invalid ones). */
function needsReview(trip: DisplayTrip) {
  return trip.isSynced && trip.userConfirmed === null && trip.isValid !== false;
}

/** Trip the system flagged as invalid that the user hasn't acted on yet. */
function isFlagged(trip: DisplayTrip) {
  return trip.isValid === false && trip.userConfirmed === null;
}

export default function TripHistoryScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation('maps');
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const { unitSystem, formatWeight } = useUnits();

  // Fetch trips from backend API
  const { data: backendTrips, isLoading, refetch, isRefetching, isFetched, isError: backendError } = useTrips({ status: 'completed' });
  const listRef = useRef<FlatList<TripListRow<DisplayTrip>>>(null);

  const [syncing, setSyncing] = useState(false);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [ratedTripIds, setRatedTripIds] = useState<Set<string>>(new Set());
  const [localTrips, setLocalTrips] = useState<DBTrip[]>([]);
  const [localLoading, setLocalLoading] = useState(true);
  const { isOnline } = useNetworkStatus();
  const [shareModalTripId, setShareModalTripId] = useState<number | null>(null);
  const [shareModalDistance, setShareModalDistance] = useState<number | undefined>(undefined);
  const [cachedBackendTrips, setCachedBackendTrips] = useState<ApiTrip[] | null>(null);

  // All trips (including backend-flagged ones) are shown by default.
  const [filter, setFilter] = useState<TripFilter>('all');

  // Multi-select state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatching, setIsBatching] = useState(false);

  const loadLocalData = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    loadLocalData();

    // Auto-refresh local data every 30 seconds to keep unsynced count updated
    const interval = setInterval(() => {
      loadLocalData();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [loadLocalData]);

  // Load cached backend trips from AsyncStorage on mount (for offline fallback)
  useEffect(() => {
    AsyncStorage.getItem(TRIPS_CACHE_KEY)
      .then((raw) => {
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

  // Reload local trips whenever the screen regains focus
  useFocusEffect(
    useCallback(() => {
      loadLocalData();
    }, [loadLocalData])
  );

  // Auto-sync unsynced trips whenever this screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (isOnline && unsyncedCount > 0 && !syncing) {
        syncService.syncTrips().then(() => {
          loadLocalData();
          refetch();
        }).catch(err => {
          console.warn('[TripHistory] Auto-sync failed:', err);
        });
      }
    }, [isOnline, unsyncedCount, syncing, loadLocalData, refetch])
  );

  // Get the display trips based on data source, filter out unsupported types and junk distances
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
        distance: trip.distance * 1000, // km to meters
        duration: trip.duration,
        co2Saved: trip.co2_saved,
        isSynced: true,
        hasRoute: (trip.route && trip.route.length > 0) || false,
        clientId: trip.client_id,
        isValid: trip.is_valid,
        userConfirmed: trip.user_confirmed,
      };
    }

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
        isValid: null,
        userConfirmed: null,
      };
    }

    // Local-only fallback (filtered to the v1 visible trip types: running and drive
    // trips are stored but hidden). Used while loading, or when there is no backend data.
    if (!isFetched || (backendError && !backendTrips && !cachedBackendTrips) || !resolvedBackendTrips) {
      return localTrips
        .map(localToDisplay)
        .filter((trip) => isVisibleTripType(trip.type) && isVisibleByDistance(trip))
        .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
    }

    // Backend data available: show backend trips + any local trips not yet synced
    const syncedClientIds = new Set(resolvedBackendTrips.map((trip) => trip.client_id));
    const unsyncedLocalTrips = localTrips.filter(
      (trip) => trip.synced !== 1 && !syncedClientIds.has(trip.id)
    );

    return [
      ...resolvedBackendTrips.map(backendToDisplay),
      ...unsyncedLocalTrips.map(localToDisplay),
    ]
      .filter((trip) => isVisibleTripType(trip.type) && isVisibleByDistance(trip))
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }, [backendTrips, cachedBackendTrips, backendError, localTrips, isFetched]);

  // Trips awaiting user review (synced, unconfirmed, not system-flagged)
  const unconfirmedCount = useMemo(() => allDisplayTrips.filter(needsReview).length, [allDisplayTrips]);
  const flaggedCount = useMemo(() => allDisplayTrips.filter(isFlagged).length, [allDisplayTrips]);

  // A filter whose trips have all gone away falls back to showing everything.
  const activeFilter: TripFilter =
    (filter === 'needsReview' && unconfirmedCount === 0) || (filter === 'hideFlagged' && flaggedCount === 0)
      ? 'all'
      : filter;

  const displayTrips = useMemo(() => {
    if (activeFilter === 'needsReview') return allDisplayTrips.filter(needsReview);
    if (activeFilter === 'hideFlagged') return allDisplayTrips.filter((trip) => !isFlagged(trip));
    return allDisplayTrips;
  }, [allDisplayTrips, activeFilter]);

  // Selection helpers
  function enterSelectionMode(firstId?: string) {
    setSelectionMode(true);
    setSelectedIds(new Set(firstId ? [firstId] : []));
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  function toggleSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(displayTrips.map((trip) => trip.id)));
  }

  function handleFilterChange(next: TripFilter) {
    setFilter(next);
    // Selected trips may no longer be visible under the new filter.
    if (selectionMode) setSelectedIds(new Set());
  }

  async function onRefresh() {
    await Promise.all([
      refetch(),
      loadLocalData(),
    ]);
  }

  async function handleSyncAll() {
    if (!isOnline) {
      Alert.alert(
        t('tripList.noInternet', { defaultValue: 'No Internet' }),
        t('tripList.noInternetMessage', { defaultValue: 'Please check your internet connection and try again.' }),
      );
      return;
    }

    if (syncing) return;

    setSyncing(true);
    try {
      const result = await syncService.syncTrips();

      if (result.success) {
        Alert.alert(
          t('tripList.syncComplete', { defaultValue: 'Sync Complete' }),
          `${t('tripList.syncedCount', {
            count: result.syncedCount,
            defaultValue: 'Successfully synced {{count}} trip(s).',
          })}${
            result.failedCount > 0
              ? `\n${t('tripList.failedCount', {
                  count: result.failedCount,
                  defaultValue: '{{count}} failed to sync.',
                })}`
              : ''
          }`
        );
        await Promise.all([refetch(), loadLocalData()]); // Reload to update sync status
      } else {
        Alert.alert(
          t('tripList.syncFailed', { defaultValue: 'Sync Failed' }),
          t('tripList.syncFailedMessage', { defaultValue: 'Failed to sync trips. Please try again.' }),
        );
      }
    } catch (error) {
      console.error('[TripHistory] Sync error:', error);
      Alert.alert(
        t('tripList.syncError', { defaultValue: 'Sync Error' }),
        error instanceof Error
          ? error.message
          : t('tripList.syncErrorMessage', { defaultValue: 'An error occurred while syncing.' }),
      );
    } finally {
      setSyncing(false);
    }
  }

  async function handleBatchDelete() {
    const ids = [...selectedIds];
    const backendIds = displayTrips
      .filter(trip => ids.includes(trip.id) && trip.backendId != null)
      .map(trip => trip.backendId!);

    Alert.alert(
      ids.length === 1
        ? t('tripList.deleteOneTitle', { defaultValue: 'Delete 1 trip?' })
        : t('tripList.deleteManyTitle', { count: ids.length, defaultValue: 'Delete {{count}} trips?' }),
      t('tripList.deleteMessage', { defaultValue: 'This cannot be undone.' }),
      [
        { text: t('tripList.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('tripList.delete', { defaultValue: 'Delete' }),
          style: 'destructive',
          onPress: async () => {
            setIsBatching(true);
            try {
              setLocalTrips(prev => prev.filter(trip => !ids.includes(trip.id)));
              exitSelectionMode();

              if (backendIds.length > 0) {
                const results = await Promise.allSettled(
                  backendIds.map(id => tripAPI.deleteTrip(id))
                );
                const failedCount = results.filter(r => r.status === 'rejected').length;
                if (failedCount > 0) {
                  Alert.alert(
                    t('tripList.partialFailure', { defaultValue: 'Partial failure' }),
                    t('tripList.deletePartialMessage', {
                      done: backendIds.length - failedCount,
                      total: backendIds.length,
                      failed: failedCount,
                      defaultValue: 'Deleted {{done}} of {{total}} trips. {{failed}} failed.',
                    }),
                  );
                }
              }
              await Promise.all([refetch(), loadLocalData()]);
            } catch {
              Alert.alert(
                t('tripList.error', { defaultValue: 'Error' }),
                t('tripList.deleteError', { defaultValue: 'Could not delete trips. Please try again.' }),
              );
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
      .filter(trip => ids.includes(trip.id) && trip.backendId != null)
      .map(trip => trip.backendId!);

    Alert.alert(
      t('tripList.notYoursTitle', { defaultValue: 'Not your trips?' }),
      ids.length === 1
        ? t('tripList.notYoursMessageOne', {
            defaultValue: "Mark 1 trip as not yours? It'll move out of your review queue.",
          })
        : t('tripList.notYoursMessageMany', {
            count: ids.length,
            defaultValue: "Mark {{count}} trips as not yours? They'll move out of your review queue.",
          }),
      [
        { text: t('tripList.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('tripList.notMyTrip', { defaultValue: 'Not my trip' }),
          style: 'destructive',
          onPress: async () => {
            setIsBatching(true);
            try {
              exitSelectionMode();
              if (backendIds.length > 0) {
                const result = await tripAPI.batchUpdate(backendIds, { user_confirmed: false });
                if (result.failed.length > 0) {
                  Alert.alert(
                    t('tripList.partialFailure', { defaultValue: 'Partial failure' }),
                    t('tripList.updatePartialMessage', {
                      done: result.updated.length,
                      total: backendIds.length,
                      defaultValue: 'Updated {{done}} of {{total}} trips.',
                    }),
                  );
                }
              }
              await Promise.all([refetch(), loadLocalData()]);
            } catch {
              Alert.alert(
                t('tripList.error', { defaultValue: 'Error' }),
                t('tripList.updateError', { defaultValue: 'Could not update trips. Please try again.' }),
              );
            } finally {
              setIsBatching(false);
            }
          },
        },
      ],
    );
  }

  const rows = useMemo(() => buildTripRows(displayTrips), [displayTrips]);

  function renderTrip(item: DisplayTrip, index: number) {
    const tripName = getTripTypeName(item.type);
    const isRated = ratedTripIds.has(item.clientId);
    const isSelected = selectedIds.has(item.id);

    // Navigate to trip detail - use backend ID if available, otherwise local ID
    const handlePress = () => {
      if (selectionMode) {
        toggleSelection(item.id);
        return;
      }
      if (item.backendId) {
        router.push(`/home/trip-detail?id=${item.backendId}`);
      } else {
        // Navigate to local trip detail using local client ID
        router.push(`/home/trip-detail?id=${item.clientId}&local=true`);
      }
    };

    const handleLongPress = () => {
      if (!selectionMode) enterSelectionMode(item.id);
    };

    const handleShare = () => {
      if (!item.backendId) return;
      setShareModalTripId(item.backendId);
      setShareModalDistance(item.distance / 1000); // metres → km
    };

    const statusBadge = () => {
      if (!item.isSynced) {
        return (
          <TripChip
            label={t('tripList.notSynced', { defaultValue: 'Not synced' })}
            icon={CloudArrowUpIcon}
            tone="#E08600"
          />
        );
      }
      if (item.userConfirmed === true) {
        return (
          <TripChip label={t('tripList.confirmed', { defaultValue: 'Confirmed' })} icon={CheckCircleIcon} />
        );
      }
      if (item.userConfirmed === false) {
        return <TripChip label={t('tripList.flagged', { defaultValue: 'Flagged' })} icon={XCircleIcon} />;
      }
      if (item.isValid === false) {
        return (
          <TripChip
            label={t('tripList.unverified', { defaultValue: 'Unverified' })}
            icon={ExclamationCircleIcon}
            tone="#E0481E"
          />
        );
      }
      return <CheckCircleIcon size={18} color={colors.textSecondary} />;
    };

    const dateLabel = `${item.startTime.toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })} · ${item.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    return (
      <TripCard
        type={item.type}
        typeName={tripName}
        dateLabel={dateLabel}
        index={index}
        onPress={handlePress}
        onLongPress={handleLongPress}
        selectionMode={selectionMode}
        selected={isSelected}
        badges={
          <>
            {item.isManual && <TripChip label={t('tripList.manual', { defaultValue: 'Manual' })} />}
            {statusBadge()}
            {/* Rating Badge - only show for trips with route data */}
            {item.hasRoute && <RatedBadge isRated={isRated} size="small" />}
          </>
        }
        stats={[
          { label: t('tripList.distance', { defaultValue: 'Distance' }), value: formatDistanceUtil(item.distance, unitSystem) },
          { label: t('tripList.duration', { defaultValue: 'Duration' }), value: formatDuration(item.duration) },
          { label: t('tripList.co2', { defaultValue: 'CO₂' }), value: formatWeight(item.co2Saved) },
        ]}
        footer={
          !selectionMode && item.backendId ? (
            <Pressable
              onPress={handleShare}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.shareFooter,
                { borderTopColor: colors.border, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <ShareIcon size={16} color={colors.glassTint} />
              <Text style={[styles.shareFooterText, { color: colors.glassTint }]}>
                {t('tripList.shareToGroup', { defaultValue: 'Share to Group' })}
              </Text>
            </Pressable>
          ) : undefined
        }
      />
    );
  }

  function renderRow({ item }: { item: TripListRow<DisplayTrip> }) {
    if (item.kind === 'header') return <TripSectionHeader label={item.label} />;
    return renderTrip(item.trip, item.index);
  }

  const allSelected = displayTrips.length > 0 && selectedIds.size === displayTrips.length;

  const iconAction = (label: string, icon: React.ReactNode, onPress: () => void) => (
    <GlassButton onPress={onPress} accessibilityLabel={label} size={40}>
      {icon}
    </GlassButton>
  );

  const syncButton =
    unsyncedCount > 0 ? (
      <View>
        {syncing ? (
          <GlassButton
            onPress={() => {}}
            accessibilityLabel={t('tripList.syncing', { defaultValue: 'Syncing trips' })}
            size={40}
          >
            <ActivityIndicator size="small" color={colors.glassTint} />
          </GlassButton>
        ) : (
          <GlassButton
            onPress={handleSyncAll}
            accessibilityLabel={t('tripList.syncTrips', { defaultValue: 'Sync trips' })}
            size={40}
            style={!isOnline && styles.dimmed}
          >
            <CloudArrowUpIcon size={22} color={isOnline ? colors.glassTint : colors.glassInactive} />
          </GlassButton>
        )}
        <View pointerEvents="none" style={[styles.countBadge, { backgroundColor: colors.primary }]}>
          <Text style={styles.countText}>{unsyncedCount}</Text>
        </View>
      </View>
    ) : null;

  const headerShell = (
    <View style={styles.header} pointerEvents="box-none">
      {selectionMode ? (
        <Header
          title={
            selectedIds.size > 0
              ? t('tripList.selectedCount', { count: selectedIds.size, defaultValue: '{{count}} selected' })
              : t('tripList.selectTrips', { defaultValue: 'Select trips' })
          }
          scrollY={scrollY}
          leftElement={iconAction(
            t('tripList.cancel', { defaultValue: 'Cancel' }),
            <XMarkIcon size={22} color={colors.glassInactive} />,
            exitSelectionMode,
          )}
          rightElement={iconAction(
            allSelected
              ? t('tripList.deselectAll', { defaultValue: 'Deselect all' })
              : t('tripList.selectAll', { defaultValue: 'Select all' }),
            allSelected ? (
              <CheckCircleSolidIcon size={24} color={colors.glassTint} />
            ) : (
              <CheckCircleIcon size={24} color={colors.glassTint} />
            ),
            allSelected ? () => setSelectedIds(new Set()) : selectAll,
          )}
          style={{ paddingTop: insets.top, minHeight: insets.top + HEADER_HEIGHT }}
        />
      ) : (
        <Header
          title={t('tripList.historyTitle', { defaultValue: 'Trip History' })}
          showBack
          scrollY={scrollY}
          rightElement={
            <View style={styles.headerRight}>
              {syncButton}
              {iconAction(
                t('tripList.select', { defaultValue: 'Select' }),
                <CheckCircleIcon size={22} color={colors.glassTint} />,
                () => enterSelectionMode(),
              )}
            </View>
          }
          style={{ paddingTop: insets.top, minHeight: insets.top + HEADER_HEIGHT }}
        />
      )}
    </View>
  );

  // Show loading only if both sources are loading
  if (isLoading && localLoading) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.backgroundSecondary }]}>
        <View style={[styles.centered, { paddingTop: insets.top + HEADER_HEIGHT }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
        {headerShell}
      </View>
    );
  }

  const showOffline = isFetched && (!isOnline || (backendError && !backendTrips));
  const showActionBar = selectionMode && selectedIds.size > 0;

  const filterItems: { key: TripFilter; label: string }[] = [
    { key: 'all', label: t('tripList.filterAll', { defaultValue: 'All trips' }) },
    ...(unconfirmedCount > 0
      ? [
          {
            key: 'needsReview' as const,
            label: `${t('tripList.filterNeedsReview', { defaultValue: 'Needs review' })} · ${unconfirmedCount}`,
          },
        ]
      : []),
    ...(flaggedCount > 0
      ? [{ key: 'hideFlagged' as const, label: t('tripList.filterHideFlagged', { defaultValue: 'Hide flagged' }) }]
      : []),
  ];

  const listHeader = (
    <View style={styles.listHeader}>
      {/* Offline Banner */}
      {showOffline && (
        <View style={styles.banner}>
          <CloudIcon size={16} color={colors.textSecondary} />
          <Text style={[styles.bannerText, { color: colors.textSecondary }]}>
            {isOnline
              ? t('tripList.showingLocal', { defaultValue: 'Showing local data' })
              : t('tripList.offlineLocal', { defaultValue: 'Offline - showing local trips' })}
          </Text>
        </View>
      )}

      {filterItems.length > 1 && (
        <View style={styles.filterRow}>
          <GlassTextSegments items={filterItems} value={activeFilter} onChange={handleFilterChange} />
        </View>
      )}
      {activeFilter === 'hideFlagged' && flaggedCount > 0 && (
        <Text style={[styles.hiddenNote, { color: colors.textSecondary }]}>
          {flaggedCount === 1
            ? t('tripList.flaggedHiddenOne', { defaultValue: '1 flagged trip hidden' })
            : t('tripList.flaggedHiddenMany', {
                count: flaggedCount,
                defaultValue: '{{count}} flagged trips hidden',
              })}
        </Text>
      )}
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.backgroundSecondary }]}>
      <Animated.FlatList
        ref={listRef}
        data={rows}
        renderItem={renderRow}
        keyExtractor={(row) => row.key}
        extraData={{ selectionMode, selectedIds, ratedTripIds }}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <TripsEmptyState
            icon={MapPinIcon}
            title={t('tripList.emptyTitle', { defaultValue: 'No trips yet' })}
            message={t('tripList.emptyMessage', {
              defaultValue: 'Enable background tracking or add a manual entry',
            })}
            actionLabel={t('tripList.addManual', { defaultValue: 'Add a manual trip' })}
            onAction={() => router.push('/home/manual-entry')}
          />
        }
        ItemSeparatorComponent={Separator}
        contentContainerStyle={{
          paddingTop: insets.top + HEADER_HEIGHT + 12,
          paddingBottom: insets.bottom + 32 + (showActionBar ? ACTION_BAR_HEIGHT : 0),
        }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            progressViewOffset={insets.top + HEADER_HEIGHT}
          />
        }
      />
      {headerShell}
      {/* Batch action bar — shown when items are selected */}
      {showActionBar && (
        <View style={[styles.actionBarWrap, { paddingBottom: insets.bottom + 8 }]} pointerEvents="box-none">
          <View style={styles.actionBar}>
            <GlassSurface borderRadius={28} />
            <Button
              title={t('tripList.deleteCount', { count: selectedIds.size, defaultValue: 'Delete ({{count}})' })}
              onPress={handleBatchDelete}
              variant="danger"
              size="medium"
              disabled={isBatching}
              icon={<TrashIcon size={18} color="#FFFFFF" />}
              style={styles.actionBarButton}
            />
            <Button
              title={t('tripList.notMyTripCount', {
                count: selectedIds.size,
                defaultValue: 'Not my trip ({{count}})',
              })}
              onPress={handleBatchNotMyTrip}
              variant="outline"
              size="medium"
              disabled={isBatching}
              icon={<NoSymbolIcon size={18} color={colors.primary} />}
              style={styles.actionBarButton}
            />
          </View>
        </View>
      )}
      <ShareTripModal
        visible={shareModalTripId !== null}
        tripId={shareModalTripId ?? 0}
        tripDistance={shareModalDistance}
        onClose={() => setShareModalTripId(null)}
      />
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { position: 'absolute', top: 0, left: 0, right: 0 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dimmed: { opacity: 0.5 },
  countBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  separator: { height: 12 },
  listHeader: { gap: 12, marginBottom: 12 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  bannerText: { fontSize: 13 },
  filterRow: { paddingHorizontal: 16, alignItems: 'flex-start' },
  hiddenNote: { fontSize: 13, paddingHorizontal: 32 },
  actionBarWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16 },
  actionBar: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: 28,
  },
  actionBarButton: { flex: 1 },
  shareFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  shareFooterText: { fontSize: 14, fontWeight: '500' },
});
