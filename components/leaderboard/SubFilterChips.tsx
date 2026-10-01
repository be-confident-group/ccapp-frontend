import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedText } from '@/components/themed-text';
import { GlassSurface } from '@/components/ui/GlassSurface';
import { Spacing } from '@/constants/theme';
import type { MainTab, RidesWalksSubFilter, GenderSubFilter } from '@/types/leaderboard';

const PRESS_SPRING = { damping: 15, stiffness: 400 };
const CHIP_RADIUS = 16;

interface SubFilterChipsProps {
  mainTab: MainTab;
  selectedFilter: RidesWalksSubFilter | GenderSubFilter;
  onFilterChange: (filter: RidesWalksSubFilter | GenderSubFilter) => void;
}

const RIDES_WALKS_FILTERS: { key: RidesWalksSubFilter; labelKey: string; fallback: string }[] = [
  { key: 'distance', labelKey: 'leaderboards.filters.distance', fallback: 'Distance' },
  { key: 'trips', labelKey: 'leaderboards.filters.trips', fallback: 'Trips' },
];

const GENDER_FILTERS: { key: GenderSubFilter; labelKey: string; fallback: string }[] = [
  { key: 'male', labelKey: 'leaderboards.filters.topMale', fallback: 'Top Male' },
  { key: 'female', labelKey: 'leaderboards.filters.topFemale', fallback: 'Top Female' },
  { key: 'new_male', labelKey: 'leaderboards.filters.newMale', fallback: 'New Male' },
  { key: 'new_female', labelKey: 'leaderboards.filters.newFemale', fallback: 'New Female' },
];

interface GlassChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

function GlassChip({ label, selected, onPress }: GlassChipProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[styles.chipShadow, { shadowColor: colors.shadow }, animatedStyle]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={label}
        onPress={onPress}
        onPressIn={() => {
          scale.value = withSpring(0.94, PRESS_SPRING);
          if (!selected && process.env.EXPO_OS !== 'web') {
            Haptics.selectionAsync();
          }
        }}
        onPressOut={() => {
          scale.value = withSpring(1, PRESS_SPRING);
        }}
        style={styles.chip}
      >
        <GlassSurface borderRadius={CHIP_RADIUS} interactive />
        {selected && (
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, styles.chipFill, { backgroundColor: colors.glassActiveFill }]}
          />
        )}
        <ThemedText
          style={[
            styles.chipText,
            { color: selected ? '#FFFFFF' : colors.glassInactive, fontWeight: selected ? '600' : '500' },
          ]}
        >
          {label}
        </ThemedText>
      </Pressable>
    </Animated.View>
  );
}

export function SubFilterChips({
  mainTab,
  selectedFilter,
  onFilterChange,
}: SubFilterChipsProps) {
  const { t } = useTranslation('groups');

  const filters = mainTab === 'gender' ? GENDER_FILTERS : RIDES_WALKS_FILTERS;

  return (
    <View style={styles.row}>
      {filters.map((filter) => (
        <GlassChip
          key={filter.key}
          label={t(filter.labelKey, filter.fallback)}
          selected={selectedFilter === filter.key}
          onPress={() => onFilterChange(filter.key)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  chipShadow: {
    borderRadius: CHIP_RADIUS,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  chip: {
    height: CHIP_RADIUS * 2,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipFill: {
    borderRadius: CHIP_RADIUS,
  },
  chipText: {
    fontSize: 13,
  },
});
