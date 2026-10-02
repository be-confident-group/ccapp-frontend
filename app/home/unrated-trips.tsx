/**
 * Unrated Trips Screen
 *
 * Displays a list of trips that haven't been rated yet.
 * Users can select a trip to rate from this list.
 */

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  LockClosedIcon,
  MapPinIcon,
  QuestionMarkCircleIcon,
  ShieldCheckIcon,
  StarIcon,
  XMarkIcon,
} from 'react-native-heroicons/outline';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { UnratedTripCard } from '@/components/rating';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui';
import { GlassSurface } from '@/components/ui/GlassSurface';
import { useTheme } from '@/contexts/ThemeContext';
import { database, type Trip } from '@/lib/database';
import { useTrips } from '@/lib/hooks/useTrips';
import type { ApiTrip } from '@/lib/api/trips';
import { isVisibleTripType } from '@/lib/utils/tripTypeUi';

const HEADER_HEIGHT = 56;
const PRESS_SPRING = { damping: 15, stiffness: 400 };
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function transformApiTripToLocal(apiTrip: ApiTrip): Trip {
  return {
    id: apiTrip.client_id,
    user_id: apiTrip.user.toString(),
    type: apiTrip.type,
    status: apiTrip.status,
    is_manual: apiTrip.is_manual ? 1 : 0,
    start_time: new Date(apiTrip.start_timestamp).getTime(),
    end_time: new Date(apiTrip.end_timestamp).getTime(),
    distance: apiTrip.distance * 1000, // Convert km to meters
    duration: apiTrip.duration,
    avg_speed: apiTrip.average_speed,
    max_speed: 0, // Not available from backend
    elevation_gain: apiTrip.elevation_gain || 0,
    calories: 0, // Not available from backend
    co2_saved: apiTrip.co2_saved,
    notes: apiTrip.notes || null,
    route_data: apiTrip.route ? JSON.stringify(apiTrip.route) : null,
    created_at: new Date(apiTrip.created_at).getTime(),
    updated_at: new Date(apiTrip.updated_at).getTime(),
    synced: 1,
    backend_id: apiTrip.id,
    ml_activity_type: null,
    ml_confidence: null,
    classification_method: 'speed',
  };
}

export default function UnratedTripsScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation('maps');
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const infoScale = useSharedValue(1);
  const infoPressStyle = useAnimatedStyle(() => ({ transform: [{ scale: infoScale.value }] }));
  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const [ratedTripIds, setRatedTripIds] = useState<Set<string>>(new Set());
  const [showInfoModal, setShowInfoModal] = useState(false);

  // Fetch completed trips from backend
  const { data: backendTrips, isLoading, refetch, isRefetching } = useTrips({ status: 'completed' });

  // Load rated trip IDs from local database
  const loadRatedTrips = useCallback(async () => {
    try {
      await database.init();
      const ratings = await database.getAllRatings();
      const ratedIds = new Set(ratings.map((r) => r.trip_id));
      setRatedTripIds(ratedIds);
    } catch (error) {
      console.error('[UnratedTrips] Error loading ratings:', error);
    }
  }, []);

  // Load on mount and when screen comes into focus
  useEffect(() => {
    loadRatedTrips();
  }, [loadRatedTrips]);

  useFocusEffect(
    useCallback(() => {
      loadRatedTrips();
      refetch();
    }, [loadRatedTrips, refetch])
  );

  // Filter for unrated trips with route data (walk/cycle only)
  const unratedTrips = useMemo(() => {
    if (!backendTrips) return [];

    return backendTrips
      .filter((trip) => trip.is_valid !== false) // Exclude invalid/drift trips
      .filter((trip) => trip.route && trip.route.length > 0) // Only trips with route data
      .filter((trip) => isVisibleTripType(trip.type)) // v1: only walk + cycle
      .filter((trip) => !ratedTripIds.has(trip.client_id)) // Only unrated trips
      .map(transformApiTripToLocal);
  }, [backendTrips, ratedTripIds]);

  // Keep a mapping of client_id to backend ID for navigation
  const clientIdToBackendId = useMemo(() => {
    if (!backendTrips) return new Map<string, number>();
    
    return new Map(
      backendTrips.map(trip => [trip.client_id, trip.id])
    );
  }, [backendTrips]);

  const onRefresh = async () => {
    await Promise.all([refetch(), loadRatedTrips()]);
  };

  const handleTripPress = (trip: Trip) => {
    // Use the backend ID for navigation
    const backendId = clientIdToBackendId.get(trip.id);
    if (backendId) {
      router.push(`/home/rate-route?id=${backendId}`);
    } else {
      console.error('[UnratedTrips] Backend ID not found for client_id:', trip.id);
    }
  };

  const renderTrip = ({ item, index }: { item: Trip; index: number }) => (
    <UnratedTripCard trip={item} index={index} onPress={() => handleTripPress(item)} />
  );

  const headerTop = insets.top;

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}>
        <View style={{ paddingTop: headerTop }}>
          <Header showBack />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  const benefits = [
    {
      Icon: ExclamationTriangleIcon,
      text: t('rating.benefitDangerous', {
        defaultValue: 'Spot dangerous intersections and roads that need attention',
      }),
    },
    {
      Icon: MapPinIcon,
      text: t('rating.benefitBikeLanes', {
        defaultValue: 'Help councils prioritize where to add bike lanes',
      }),
    },
    {
      Icon: StarIcon,
      text: t('rating.benefitGreatRoutes', {
        defaultValue: 'Highlight the great routes so others can discover them',
      }),
    },
    {
      Icon: ShieldCheckIcon,
      text: t('rating.benefitAnonymized', {
        defaultValue: 'All feedback is anonymized to protect your privacy',
      }),
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}>
      {/* Content */}
      {unratedTrips.length === 0 ? (
        <View style={[styles.empty, { paddingTop: headerTop + HEADER_HEIGHT }]}>
          <View style={[styles.emptyCircle, { backgroundColor: colors.glassHighlight }]}>
            <CheckCircleIcon size={30} color={colors.glassTint} />
          </View>
          <ThemedText style={styles.emptyTitle}>
            {t('rating.allCaughtUp', { defaultValue: 'All caught up!' })}
          </ThemedText>
          <ThemedText style={[styles.emptySubtext, { color: colors.textSecondary }]}>
            {t('rating.allCaughtUpText', {
              defaultValue:
                "You've rated all your trips. New trips will appear here after you complete them.",
            })}
          </ThemedText>
          <Button
            title={t('rating.done', { defaultValue: 'Done' })}
            onPress={() => router.back()}
            variant="primary"
            size="medium"
            style={styles.emptyButton}
          />
        </View>
      ) : (
        <Animated.FlatList
          data={unratedTrips}
          renderItem={renderTrip}
          keyExtractor={(item) => item.id}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          contentContainerStyle={[
            styles.list,
            { paddingTop: headerTop + HEADER_HEIGHT + 8, paddingBottom: insets.bottom + 88 },
          ]}
          ItemSeparatorComponent={Separator}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              progressViewOffset={headerTop + HEADER_HEIGHT}
            />
          }
          ListHeaderComponent={
            <ThemedText style={[styles.listHeader, { color: colors.textSecondary }]}>
              {t('rating.selectTripToRate', { defaultValue: 'Select a trip to rate your experience' })}
            </ThemedText>
          }
        />
      )}

      {/* Header */}
      <View style={[styles.headerWrap, { paddingTop: headerTop }]}>
        <Header
          showBack
          scrollY={scrollY}
          title={t('rating.rateMyRoutes', { defaultValue: 'Rate My Routes' })}
          rightElement={
            unratedTrips.length > 0 ? (
              <View style={[styles.countBadge, { backgroundColor: colors.glassHighlight }]}>
                <ThemedText style={[styles.countText, { color: colors.glassTint }]}>
                  {unratedTrips.length}
                </ThemedText>
              </View>
            ) : undefined
          }
        />
      </View>

      {/* Floating glass info capsule */}
      <Animated.View
        entering={FadeIn.delay(200)}
        style={[
          styles.floatingInfo,
          { bottom: insets.bottom + 16, shadowColor: colors.shadow },
          infoPressStyle,
        ]}
      >
        <AnimatedPressable
          accessibilityRole="button"
          accessibilityLabel={t('rating.whyRate', { defaultValue: 'Why rate routes?' })}
          onPress={() => setShowInfoModal(true)}
          onPressIn={() => {
            infoScale.value = withSpring(0.96, PRESS_SPRING);
            if (process.env.EXPO_OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            }
          }}
          onPressOut={() => {
            infoScale.value = withSpring(1, PRESS_SPRING);
          }}
          style={styles.floatingInfoInner}
        >
          <GlassSurface borderRadius={22} interactive />
          <QuestionMarkCircleIcon size={20} color={colors.glassTint} />
          <ThemedText style={[styles.floatingInfoText, { color: colors.glassTint }]}>
            {t('rating.whyRate', { defaultValue: 'Why rate routes?' })}
          </ThemedText>
        </AnimatedPressable>
      </Animated.View>

      {/* Info Modal */}
      <Modal
        visible={showInfoModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowInfoModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowInfoModal(false)}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: colors.card }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('rating.close', { defaultValue: 'Close' })}
              style={styles.modalCloseButton}
              onPress={() => setShowInfoModal(false)}
              hitSlop={8}
            >
              <XMarkIcon size={22} color={colors.textSecondary} />
            </Pressable>

            <View style={styles.modalHeaderSection}>
              <ThemedText style={[styles.modalTitle, { color: colors.text }]}>
                {t('rating.infoTitle', { defaultValue: 'Your Routes Build Better Cities' })}
              </ThemedText>
              <ThemedText style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                {t('rating.infoSubtitle', {
                  defaultValue: 'Each rating you share becomes valuable data for urban planning',
                })}
              </ThemedText>
            </View>

            <View style={styles.benefitsList}>
              {benefits.map(({ Icon, text }) => (
                <View key={text} style={styles.benefitItem}>
                  <Icon size={20} color={colors.glassTint} />
                  <ThemedText style={[styles.benefitText, { color: colors.text }]}>{text}</ThemedText>
                </View>
              ))}
            </View>

            <View style={[styles.modalFooterNote, { backgroundColor: colors.backgroundSecondary }]}>
              <LockClosedIcon size={16} color={colors.textSecondary} />
              <ThemedText style={[styles.footerNoteText, { color: colors.textSecondary }]}>
                {t('rating.privacyNote', {
                  defaultValue: 'Your exact routes are never shared — only aggregated patterns',
                })}
              </ThemedText>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  countBadge: {
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countText: {
    fontSize: 14,
    fontWeight: '700',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    paddingHorizontal: 16,
  },
  separator: {
    height: 12,
  },
  listHeader: {
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 96,
    gap: 12,
  },
  emptyCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 4,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyButton: {
    marginTop: 8,
    minWidth: 160,
  },
  // Floating glass info capsule
  floatingInfo: {
    position: 'absolute',
    alignSelf: 'center',
    borderRadius: 22,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 6,
  },
  floatingInfoInner: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: 16,
    gap: 6,
  },
  floatingInfoText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    padding: 20,
    paddingTop: 28,
    gap: 16,
  },
  modalCloseButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  modalHeaderSection: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  benefitsList: {
    gap: 14,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  benefitText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  modalFooterNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
  },
  footerNoteText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
});
