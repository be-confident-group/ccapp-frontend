import { useTheme } from '@/contexts/ThemeContext';
import { useUnits } from '@/contexts/UnitsContext';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { ClockIcon } from 'react-native-heroicons/outline';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { TripManager } from '@/lib/services/TripManager';
import { getTripTypeIcon, getTripTypeColor, type TripType } from '@/types/trip';
import { formatDurationHuman, parseRouteData } from '@/lib/utils/geoCalculations';
import type { Trip } from '@/lib/database/db';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MIN_TRANSLATE_Y = 140; // Minimum height when collapsed
const MAX_TRANSLATE_Y = SCREEN_HEIGHT * 0.75; // Maximum height when expanded

interface MapBottomSheetProps {
  onTripPress?: (tripId: string) => void;
  onExpandChange?: (isExpanded: boolean) => void;
  selectedTripId?: string | null;
}

export function MapBottomSheet({ onTripPress, onExpandChange, selectedTripId }: MapBottomSheetProps) {
  const { colors, isDark } = useTheme();
  const { formatDistance } = useUnits();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const translateY = useSharedValue(SCREEN_HEIGHT - MIN_TRANSLATE_Y - insets.bottom);
  const [isExpanded, setIsExpanded] = useState(false);
  const [recentTrips, setRecentTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  const context = useSharedValue({ y: 0 });

  // Fetch recent trips from database
  useEffect(() => {
    loadRecentTrips();
  }, []);

  const loadRecentTrips = async () => {
    try {
      setLoading(true);
      const trips = await TripManager.getRecentTrips(10);
      setRecentTrips(trips);
    } catch (error) {
      console.error('[MapBottomSheet] Error loading recent trips:', error);
    } finally {
      setLoading(false);
    }
  };

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
      translateY.value = Math.max(
        SCREEN_HEIGHT - MAX_TRANSLATE_Y,
        Math.min(context.value.y + event.translationY, SCREEN_HEIGHT - MIN_TRANSLATE_Y - insets.bottom)
      );
    })
    .onEnd((event) => {
      'worklet';
      const shouldExpand = event.velocityY < -500 || translateY.value < SCREEN_HEIGHT - MAX_TRANSLATE_Y / 2;

      if (shouldExpand) {
        translateY.value = withSpring(SCREEN_HEIGHT - MAX_TRANSLATE_Y, {
          damping: 50,
          stiffness: 400,
        });
        runOnJS(handleExpandChange)(true);
      } else {
        translateY.value = withSpring(SCREEN_HEIGHT - MIN_TRANSLATE_Y - insets.bottom, {
          damping: 50,
          stiffness: 400,
        });
        runOnJS(handleExpandChange)(false);
      }
    });

  const rBottomSheetStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    };
  });

  const handleTripPress = (tripId: string) => {
    console.log('[MapBottomSheet] Trip pressed:', tripId);
    if (onTripPress) {
      onTripPress(tripId);
    }
  };

  const handleSeeAllTrips = () => {
    console.log('[MapBottomSheet] Navigating to trip history');
    router.push('/home/trip-history');
  };

  // Helper function to format trip date
  const formatTripDate = (timestamp: number): string => {
    const tripDate = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - tripDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Today, ${tripDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return `Yesterday, ${tripDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    } else if (diffDays < 7) {
      return `${diffDays} days ago, ${tripDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    } else {
      return tripDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    }
  };

  // Helper function to get trip route description
  const getTripRouteDescription = (trip: Trip): string => {
    if (!trip.route_data) return 'No route data';

    try {
      const route = parseRouteData(trip.route_data);
      if (route.length < 2) return 'Short trip';

      // For now, just show distance - could be enhanced with geocoding
      const distanceKm = (trip.distance || 0) / 1000;
      return `${distanceKm.toFixed(1)} km route`;
    } catch (error) {
      return 'Route data unavailable';
    }
  };

  // Get icon name for trip type
  const getIconName = (type: TripType): keyof typeof MaterialIcons.glyphMap => {
    const iconMap: Record<TripType, keyof typeof MaterialIcons.glyphMap> = {
      walk: 'directions-walk',
      run: 'directions-run',
      cycle: 'directions-bike',
      drive: 'directions-car',
    };
    return iconMap[type];
  };

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          styles.bottomSheetContainer,
          rBottomSheetStyle,
          {
            backgroundColor: isDark ? colors.card : '#FFFFFF',
          },
        ]}
      >
        {/* Drag Handle */}
        <View style={styles.handleContainer}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Recent Journeys
              </Text>
              <Text style={[styles.tripCount, { color: colors.textSecondary }]}>
                {loading ? '...' : `${recentTrips.length} trips`}
              </Text>
            </View>
            <Pressable
              style={[styles.seeAllButton, { backgroundColor: colors.primary }]}
              onPress={handleSeeAllTrips}
              android_ripple={{ color: '#ffffff20' }}
            >
              <Text style={styles.seeAllButtonText}>See All Trips</Text>
              <MaterialIcons name="arrow-forward" size={16} color="#ffffff" />
            </Pressable>
          </View>

          {/* Recent Trips List */}
          <ScrollView
            style={styles.tripsList}
            showsVerticalScrollIndicator={!isExpanded}
            scrollEnabled={isExpanded}
          >
            {loading ? (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  Loading trips...
                </Text>
              </View>
            ) : recentTrips.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialIcons name="route" size={48} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No trips yet
                </Text>
                <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
                  Start tracking to see your journeys here
                </Text>
              </View>
            ) : (
              recentTrips.map((trip, index) => {
                const tripColor = getTripTypeColor(trip.type);
                const isSelected = selectedTripId === trip.id;

                return (
                  <Pressable
                    key={trip.id}
                    style={[
                      styles.tripCard,
                      {
                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F8F9FA',
                        borderColor: isSelected ? tripColor : colors.border,
                        borderWidth: isSelected ? 2 : 1,
                      },
                      index === 0 && !isExpanded && styles.firstTripCard,
                    ]}
                    onPress={() => handleTripPress(trip.id)}
                    android_ripple={{ color: colors.primary + '10' }}
                  >
                    {/* Icon */}
                    <View style={[styles.tripIcon, { backgroundColor: tripColor + '20' }]}>
                      <MaterialIcons name={getIconName(trip.type)} size={24} color={tripColor} />
                    </View>

                    {/* Trip Info */}
                    <View style={styles.tripInfo}>
                      <Text style={[styles.tripName, { color: colors.text }]}>
                        {trip.type.charAt(0).toUpperCase() + trip.type.slice(1)} Trip
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
                        distance
                      </Text>
                      <Text style={[styles.statValue, { color: colors.text, marginTop: 8 }]}>
                        {formatDurationHuman(trip.duration || 0)}
                      </Text>
                      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                        time
                      </Text>
                    </View>

                    {/* Chevron */}
                    <MaterialIcons
                      name="chevron-right"
                      size={20}
                      color={colors.textMuted}
                      style={styles.chevron}
                    />
                  </Pressable>
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
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 15,
    zIndex: 200,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  seeAllButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  tripsList: {
    flex: 1,
  },
  tripCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    gap: 12,
  },
  firstTripCard: {
    // Highlight first card when collapsed
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
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
