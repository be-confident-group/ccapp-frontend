import { GlassSurface } from '@/components/ui/GlassSurface';
import { useTabBarInset } from '@/contexts/TabBarContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useUnits } from '@/contexts/UnitsContext';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  ArrowPathIcon,
  ArrowRightIcon,
  BoltIcon,
  ChevronRightIcon,
  ClockIcon,
  MapIcon,
  TruckIcon,
  UserIcon,
} from 'react-native-heroicons/outline';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { getTripTypeColor, type TripType } from '@/types/trip';
import { formatDurationHuman, parseRouteData } from '@/lib/utils/geoCalculations';
import type { Trip } from '@/lib/database/db';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const EXPANDED_Y = SCREEN_HEIGHT * 0.25; // Sheet top when expanded
const PEEK_HEADER_HEIGHT = 68; // grabber + "Recent Journeys" row, must clear the tab bar
const SIDE_INSET = 8;
const TOP_RADIUS = 30;
const RUBBER_DIM = 120;
const PRESS_SPRING = { damping: 18, stiffness: 320, mass: 0.6 };

const TRIP_ICONS = {
  walk: UserIcon,
  run: BoltIcon,
  cycle: ArrowPathIcon,
  drive: TruckIcon,
} as const;

/** iOS-style rubber band: resistance grows the further past the limit you drag. */
function rubberBand(over: number): number {
  'worklet';
  return (1 - 1 / ((over * 0.55) / RUBBER_DIM + 1)) * RUBBER_DIM;
}

function lightHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Wraps children in a spring press-scale; haptic fires on press-in when requested. */
function PressScale({
  children,
  onPress,
  style,
  pressedScale = 0.97,
  haptic = false,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress: () => void;
  style?: React.ComponentProps<typeof Animated.View>['style'];
  pressedScale?: number;
  haptic?: boolean;
  accessibilityLabel?: string;
}) {
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[style, aStyle]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPressIn={() => {
          scale.value = withSpring(pressedScale, PRESS_SPRING);
          if (haptic) lightHaptic();
        }}
        onPressOut={() => {
          scale.value = withSpring(1, PRESS_SPRING);
        }}
        onPress={onPress}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

interface MapBottomSheetProps {
  onTripPress?: (tripId: string) => void;
  onExpandChange?: (isExpanded: boolean) => void;
  selectedTripId?: string | null;
  trips?: Trip[];
}

export function MapBottomSheet({ onTripPress, onExpandChange, selectedTripId, trips = [] }: MapBottomSheetProps) {
  const { colors, isDark } = useTheme();
  const { formatDistance } = useUnits();
  const { t } = useTranslation();
  const tabBarInset = useTabBarInset();
  const router = useRouter();

  // Collapsed: the header row sits fully above the floating tab bar.
  const collapsedY = SCREEN_HEIGHT - tabBarInset - PEEK_HEADER_HEIGHT;

  const translateY = useSharedValue(collapsedY);
  const [isExpanded, setIsExpanded] = useState(false);
  const expandedSV = useSharedValue(false);
  const context = useSharedValue({ y: 0 });

  const handleExpandChange = useCallback((expanded: boolean) => {
    setIsExpanded(expanded);
    if (onExpandChange) {
      onExpandChange(expanded);
    }
  }, [onExpandChange]);

  const gesture = Gesture.Pan()
    .onStart(() => {
      context.value = { y: translateY.value };
    })
    .onUpdate((event) => {
      const raw = context.value.y + event.translationY;
      if (raw < EXPANDED_Y) {
        translateY.value = EXPANDED_Y - rubberBand(EXPANDED_Y - raw);
      } else if (raw > collapsedY) {
        translateY.value = collapsedY + rubberBand(raw - collapsedY);
      } else {
        translateY.value = raw;
      }
    })
    .onEnd((event) => {
      'worklet';
      // Project where the sheet would land with its current momentum.
      const projected = translateY.value + event.velocityY * 0.15;
      const midpoint = (EXPANDED_Y + collapsedY) / 2;
      const shouldExpand =
        event.velocityY < -500 || (event.velocityY <= 500 && projected < midpoint);

      translateY.value = withSpring(shouldExpand ? EXPANDED_Y : collapsedY, {
        damping: 30,
        stiffness: 260,
        mass: 1,
        velocity: event.velocityY,
      });

      if (shouldExpand !== expandedSV.value) {
        expandedSV.value = shouldExpand;
        runOnJS(lightHaptic)();
        runOnJS(handleExpandChange)(shouldExpand);
      }
    });

  const rBottomSheetStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    };
  });

  const handleTripPress = (tripId: string) => {
    // Collapse the bottom sheet
    translateY.value = withSpring(collapsedY, { damping: 30, stiffness: 260 });
    expandedSV.value = false;
    handleExpandChange(false);

    if (onTripPress) {
      onTripPress(tripId);
    }
  };

  const handleSeeAllTrips = () => {
    router.push('/home/trip-history');
  };

  // Helper function to format trip date
  const formatTripDate = (timestamp: number): string => {
    const tripDate = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - tripDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const time = tripDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

    if (diffDays === 0) {
      return t('maps:bottomSheet.todayAt', { time, defaultValue: 'Today, {{time}}' });
    } else if (diffDays === 1) {
      return t('maps:bottomSheet.yesterdayAt', { time, defaultValue: 'Yesterday, {{time}}' });
    } else if (diffDays < 7) {
      return t('maps:bottomSheet.daysAgoAt', {
        count: diffDays,
        time,
        defaultValue: '{{count}} days ago, {{time}}',
      });
    }
    return tripDate.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Helper function to get trip route description
  const getTripRouteDescription = (trip: Trip): string => {
    if (!trip.route_data) {
      return t('maps:bottomSheet.noRouteData', { defaultValue: 'No route data' });
    }

    try {
      const route = parseRouteData(trip.route_data);
      if (route.length < 2) {
        return t('maps:bottomSheet.shortTrip', { defaultValue: 'Short trip' });
      }

      // For now, just show distance - could be enhanced with geocoding
      const distanceKm = (trip.distance || 0) / 1000;
      return t('maps:bottomSheet.kmRoute', {
        distance: distanceKm.toFixed(1),
        defaultValue: '{{distance}} km route',
      });
    } catch {
      return t('maps:bottomSheet.routeUnavailable', { defaultValue: 'Route data unavailable' });
    }
  };

  const getTripName = (type: TripType): string =>
    t(`maps:bottomSheet.tripName.${type}`, {
      defaultValue: `${type.charAt(0).toUpperCase() + type.slice(1)} Trip`,
    });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.bottomSheetContainer, rBottomSheetStyle]}>
        <GlassSurface borderRadius={TOP_RADIUS} />

        {/* Drag Handle */}
        <View style={styles.handleContainer}>
          <View style={[styles.handle, { backgroundColor: colors.glassInactive }]} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t('maps:bottomSheet.recentJourneys', { defaultValue: 'Recent Journeys' })}
              </Text>
              <Text style={[styles.tripCount, { color: colors.textSecondary }]}>
                {t('maps:bottomSheet.tripCount', {
                  count: trips.length,
                  defaultValue: '{{count}} trips',
                  defaultValue_one: '{{count}} trip',
                })}
              </Text>
            </View>
            <PressScale onPress={handleSeeAllTrips} haptic pressedScale={0.94}>
              <View style={styles.seeAllButton}>
                <GlassSurface borderRadius={16} interactive />
                <Text style={[styles.seeAllButtonText, { color: colors.text }]}>
                  {t('maps:bottomSheet.seeAllTrips', { defaultValue: 'See All Trips' })}
                </Text>
                <ArrowRightIcon size={14} color={colors.text} />
              </View>
            </PressScale>
          </View>

          {/* Recent Trips List */}
          <ScrollView
            style={styles.tripsList}
            contentContainerStyle={{ paddingBottom: tabBarInset + 24 }}
            showsVerticalScrollIndicator={!isExpanded}
            scrollEnabled={isExpanded}
          >
            {trips.length === 0 ? (
              <View style={styles.emptyState}>
                <MapIcon size={48} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {t('maps:bottomSheet.noTrips', { defaultValue: 'No trips yet' })}
                </Text>
                <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
                  {t('maps:bottomSheet.noTripsHint', {
                    defaultValue: 'Start tracking to see your journeys here',
                  })}
                </Text>
              </View>
            ) : (
              trips.map((trip) => {
                const tripColor = getTripTypeColor(trip.type);
                const isSelected = selectedTripId === trip.id;
                const TripIcon = TRIP_ICONS[trip.type];

                return (
                  <PressScale
                    key={trip.id}
                    onPress={() => handleTripPress(trip.id)}
                    style={styles.tripCardWrap}
                    pressedScale={0.98}
                  >
                    <View
                      style={[
                        styles.tripCard,
                        {
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.85)',
                          borderColor: isSelected ? tripColor : colors.border,
                          borderWidth: isSelected ? 2 : 1,
                        },
                      ]}
                    >
                      {/* Icon */}
                      <View style={[styles.tripIcon, { backgroundColor: tripColor + '20' }]}>
                        <TripIcon size={24} color={tripColor} />
                      </View>

                      {/* Trip Info */}
                      <View style={styles.tripInfo}>
                        <Text style={[styles.tripName, { color: colors.text }]}>
                          {getTripName(trip.type)}
                        </Text>
                        <Text style={[styles.tripRoute, { color: colors.textSecondary }]}>
                          {getTripRouteDescription(trip)}
                        </Text>
                        <View style={styles.tripMeta}>
                          <View style={styles.metaItem}>
                            <ClockIcon size={14} color={colors.textMuted} />
                            <Text style={[styles.metaText, { color: colors.textMuted }]}>
                              {formatTripDate(trip.start_time)}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Stats */}
                      <View style={styles.tripStats}>
                        <Text style={[styles.statValue, { color: colors.text }]}>
                          {formatDistance((trip.distance || 0) / 1000)}
                        </Text>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                          {t('maps:bottomSheet.distance', { defaultValue: 'distance' })}
                        </Text>
                        <Text style={[styles.statValue, { color: colors.text, marginTop: 8 }]}>
                          {formatDurationHuman(trip.duration || 0)}
                        </Text>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                          {t('maps:bottomSheet.time', { defaultValue: 'time' })}
                        </Text>
                      </View>

                      {/* Chevron */}
                      <ChevronRightIcon size={18} color={colors.textMuted} style={styles.chevron} />
                    </View>
                  </PressScale>
                );
              })
            )}
          </ScrollView>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  bottomSheetContainer: {
    position: 'absolute',
    top: 0,
    left: SIDE_INSET,
    right: SIDE_INSET,
    height: SCREEN_HEIGHT,
    zIndex: 200,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 8,
  },
  handle: {
    width: 36,
    height: 5,
    borderRadius: 3,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  tripCount: {
    fontSize: 14,
    fontWeight: '500',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 32,
    borderRadius: 16,
    gap: 6,
  },
  seeAllButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tripsList: {
    flex: 1,
  },
  tripCardWrap: {
    marginBottom: 12,
  },
  tripCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  tripIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripInfo: {
    flex: 1,
    gap: 4,
  },
  tripName: {
    fontSize: 16,
    fontWeight: '600',
  },
  tripRoute: {
    fontSize: 13,
  },
  tripMeta: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
  },
  tripStats: {
    alignItems: 'flex-end',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  statLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
  },
  chevron: {
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
});
