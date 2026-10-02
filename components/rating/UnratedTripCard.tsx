/**
 * UnratedTripCard Component
 *
 * A card component for displaying unrated trips in the list.
 * Shows trip type, date, distance, and a "Rate" affordance.
 */

import React from 'react';
import { View, Pressable, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  BoltIcon,
  ChevronRightIcon,
  LifebuoyIcon,
  TruckIcon,
  UserIcon,
} from 'react-native-heroicons/outline';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { useUnits } from '@/contexts/UnitsContext';
import { getTripTypeName, type TripType } from '@/types/trip';
import { formatDistance } from '@/lib/utils/geoCalculations';
import type { Trip } from '@/lib/database';

const PRESS_SPRING = { damping: 26, stiffness: 420 };
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const TRIP_TYPE_ICONS: Record<TripType, typeof UserIcon> = {
  walk: UserIcon,
  run: BoltIcon,
  cycle: LifebuoyIcon,
  drive: TruckIcon,
};

interface UnratedTripCardProps {
  trip: Trip;
  onPress: () => void;
  style?: ViewStyle;
  /** Position in the list; drives the staggered entrance. */
  index?: number;
}

export default function UnratedTripCard({
  trip,
  onPress,
  style,
  index = 0,
}: UnratedTripCardProps) {
  const { colors } = useTheme();
  const { t } = useTranslation('maps');
  const { unitSystem } = useUnits();
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const tripName = getTripTypeName(trip.type as TripType);
  const TripIcon = TRIP_TYPE_ICONS[trip.type as TripType] ?? UserIcon;
  const date = new Date(trip.start_time);

  const formattedDate = date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 8) * 40).duration(280).easing(Easing.out(Easing.cubic))}
      style={style}
    >
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel={`${tripName}, ${formattedDate}`}
        onPress={onPress}
        onPressIn={() => {
          scale.value = withSpring(0.98, PRESS_SPRING);
          if (process.env.EXPO_OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          }
        }}
        onPressOut={() => {
          scale.value = withSpring(1, PRESS_SPRING);
        }}
        style={[styles.card, { backgroundColor: colors.card }, pressStyle]}
      >
        <TripIcon size={26} color={colors.glassTint} />

        <View style={styles.details}>
          <ThemedText style={styles.tripName}>{tripName}</ThemedText>
          <View style={styles.metaRow}>
            <ThemedText style={[styles.metaText, { color: colors.textSecondary }]}>
              {formattedDate}
            </ThemedText>
            <View style={[styles.dot, { backgroundColor: colors.textSecondary }]} />
            <ThemedText style={[styles.metaText, { color: colors.textSecondary }]}>
              {formatDistance(trip.distance, unitSystem)}
            </ThemedText>
          </View>
        </View>

        <View style={[styles.action, { backgroundColor: colors.glassHighlight }]}>
          <ThemedText style={[styles.actionText, { color: colors.glassTint }]}>
            {t('rating.rate', { defaultValue: 'Rate' })}
          </ThemedText>
          <ChevronRightIcon size={14} color={colors.glassTint} />
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 20,
  },
  details: {
    flex: 1,
  },
  tripName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 13,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    marginHorizontal: 8,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 6,
    borderRadius: 999,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
