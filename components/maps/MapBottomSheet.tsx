import { useTheme } from '@/contexts/ThemeContext';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
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

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MIN_TRANSLATE_Y = 140; // Minimum height when collapsed
const MAX_TRANSLATE_Y = SCREEN_HEIGHT * 0.75; // Maximum height when expanded

// Mock recent trips data
const RECENT_TRIPS = [
  {
    id: '1',
    name: 'Morning Commute',
    date: 'Today, 8:30 AM',
    distance: '12.5 km',
    duration: '35 min',
    type: 'cycle',
    route: 'Market St → Downtown',
  },
  {
    id: '2',
    name: 'Evening Ride',
    date: 'Yesterday, 6:15 PM',
    distance: '8.2 km',
    duration: '22 min',
    type: 'cycle',
    route: 'Park Loop',
  },
  {
    id: '3',
    name: 'Weekend Trail',
    date: '2 days ago, 10:00 AM',
    distance: '24.8 km',
    duration: '1h 15m',
    type: 'cycle',
    route: 'Mountain Trail',
  },
  {
    id: '4',
    name: 'City Exploration',
    date: '3 days ago, 3:45 PM',
    distance: '15.3 km',
    duration: '42 min',
    type: 'cycle',
    route: 'Waterfront → Marina',
  },
  {
    id: '5',
    name: 'Lunch Break Ride',
    date: '4 days ago, 12:30 PM',
    distance: '6.7 km',
    duration: '18 min',
    type: 'cycle',
    route: 'Office → Cafe',
  },
];

interface MapBottomSheetProps {
  onOptionPress?: (option: string) => void;
  onExpandChange?: (isExpanded: boolean) => void;
}

export function MapBottomSheet({ onOptionPress, onExpandChange }: MapBottomSheetProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(SCREEN_HEIGHT - MIN_TRANSLATE_Y - insets.bottom);
  const [isExpanded, setIsExpanded] = useState(false);

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
    console.log('Trip pressed:', tripId);
    if (onOptionPress) {
      onOptionPress(tripId);
    }
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
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Recent Journeys
            </Text>
            <Text style={[styles.tripCount, { color: colors.textSecondary }]}>
              {RECENT_TRIPS.length} trips
            </Text>
          </View>

          {/* Recent Trips List */}
          <ScrollView 
            style={styles.tripsList}
            showsVerticalScrollIndicator={!isExpanded}
            scrollEnabled={isExpanded}
          >
            {RECENT_TRIPS.map((trip, index) => (
              <Pressable
                key={trip.id}
                style={[
                  styles.tripCard,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F8F9FA',
                    borderColor: colors.border,
                  },
                  index === 0 && !isExpanded && styles.firstTripCard,
                ]}
                onPress={() => handleTripPress(trip.id)}
                android_ripple={{ color: colors.primary + '10' }}
              >
                {/* Icon */}
                <View style={[styles.tripIcon, { backgroundColor: colors.primary + '20' }]}>
                  <MaterialIcons name="directions-bike" size={24} color={colors.primary} />
                </View>

                {/* Trip Info */}
                <View style={styles.tripInfo}>
                  <Text style={[styles.tripName, { color: colors.text }]}>
                    {trip.name}
                  </Text>
                  <Text style={[styles.tripRoute, { color: colors.textSecondary }]}>
                    {trip.route}
                  </Text>
                  <View style={styles.tripMeta}>
                    <View style={styles.metaItem}>
                      <ClockIcon size={14} color={colors.textMuted} />
                      <Text style={[styles.metaText, { color: colors.textMuted }]}>
                        {trip.date}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Stats */}
                <View style={styles.tripStats}>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {trip.distance}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    distance
                  </Text>
                  <Text style={[styles.statValue, { color: colors.text, marginTop: 8 }]}>
                    {trip.duration}
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
            ))}
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  tripCount: {
    fontSize: 14,
    fontWeight: '500',
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
});
