import React, { type ReactNode, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { CheckIcon } from 'react-native-heroicons/mini';
import { ChevronRightIcon } from 'react-native-heroicons/outline';

import { useTheme } from '@/contexts/ThemeContext';
import { getTripTypeColor, type TripType } from '@/types/trip';
import { TRIP_TYPE_ICONS } from '@/components/trips/tripTypeIcons';

const PRESS_SPRING = { damping: 15, stiffness: 400 };
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface TripCardStat {
  label: string;
  value: string;
}

interface TripCardProps {
  type: TripType;
  typeName: string;
  /** Primary line, e.g. "Mon, 3 Mar · 08:15". */
  dateLabel: string;
  stats: TripCardStat[];
  /** Status chips shown on the right of the type chip. */
  badges?: ReactNode;
  /** Extra row below the stats (e.g. share action). */
  footer?: ReactNode;
  onPress: () => void;
  onLongPress?: () => void;
  /** Position in the list, used to stagger the entrance. */
  index?: number;
  selectionMode?: boolean;
  selected?: boolean;
}

/** Shared trip list card: type chip, status badges, date and a stats row. */
export function TripCard({
  type,
  typeName,
  dateLabel,
  stats,
  badges,
  footer,
  onPress,
  onLongPress,
  index = 0,
  selectionMode = false,
  selected = false,
}: TripCardProps) {
  const { colors } = useTheme();
  const TypeIcon = TRIP_TYPE_ICONS[type] ?? TRIP_TYPE_ICONS.walk;
  const tripColor = getTripTypeColor(type);

  const scale = useSharedValue(1);
  const entrance = useSharedValue(0);
  useEffect(() => {
    entrance.value = withDelay(
      Math.min(index, 8) * 45,
      withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) }),
    );
  }, [entrance, index]);

  const entranceStyle = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [{ translateY: (1 - entrance.value) * 14 }],
  }));
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[styles.wrapper, entranceStyle]}>
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={`${typeName}, ${dateLabel}`}
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={() => {
          scale.value = withSpring(0.98, PRESS_SPRING);
          if (process.env.EXPO_OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          }
        }}
        onPressOut={() => {
          scale.value = withSpring(1, PRESS_SPRING);
        }}
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: selected ? colors.glassTint : 'transparent',
          },
          pressStyle,
        ]}
      >
        {selectionMode && (
          <View
            style={[
              styles.checkbox,
              {
                borderColor: selected ? colors.glassActiveFill : colors.inputBorder,
                backgroundColor: selected ? colors.glassActiveFill : 'transparent',
              },
            ]}
          >
            {selected && <CheckIcon size={14} color="#FFFFFF" />}
          </View>
        )}

        <View style={styles.body}>
          <View style={styles.topRow}>
            <View style={[styles.typeChip, { backgroundColor: tripColor + '1F' }]}>
              <TypeIcon size={16} color={tripColor} />
              <Text style={[styles.typeText, { color: tripColor }]} numberOfLines={1}>
                {typeName}
              </Text>
            </View>
            {badges ? <View style={styles.badges}>{badges}</View> : null}
          </View>

          <View style={styles.dateRow}>
            <Text style={[styles.date, { color: colors.text }]} numberOfLines={1}>
              {dateLabel}
            </Text>
            {!selectionMode && <ChevronRightIcon size={16} color={colors.textSecondary} />}
          </View>

          <View style={styles.stats}>
            {stats.map((stat) => (
              <View key={stat.label} style={styles.stat}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{stat.label}</Text>
                <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>
                  {stat.value}
                </Text>
              </View>
            ))}
          </View>

          {footer}
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  typeChip: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  typeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  date: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  stats: {
    flexDirection: 'row',
    gap: 16,
  },
  stat: {
    flex: 1,
    gap: 2,
  },
  statLabel: {
    fontSize: 12,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '600',
  },
});
