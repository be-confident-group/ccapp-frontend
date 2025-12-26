import React from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedText } from '@/components/themed-text';
import { Spacing, BorderRadius } from '@/constants/theme';
import type { MainTab, RidesWalksSubFilter, GenderSubFilter } from '@/types/leaderboard';

interface SubFilterChipsProps {
  mainTab: MainTab;
  selectedFilter: RidesWalksSubFilter | GenderSubFilter;
  onFilterChange: (filter: RidesWalksSubFilter | GenderSubFilter) => void;
}

const RIDES_WALKS_FILTERS: { key: RidesWalksSubFilter; label: string }[] = [
  { key: 'distance', label: 'Distance' },
  { key: 'trips', label: 'Trips' },
];

const GENDER_FILTERS: { key: GenderSubFilter; label: string }[] = [
  { key: 'male', label: 'Top Male' },
  { key: 'female', label: 'Top Female' },
  { key: 'new_male', label: 'New Male' },
  { key: 'new_female', label: 'New Female' },
];

export function SubFilterChips({
  mainTab,
  selectedFilter,
  onFilterChange,
}: SubFilterChipsProps) {
  const { colors } = useTheme();

  const filters = mainTab === 'gender' ? GENDER_FILTERS : RIDES_WALKS_FILTERS;

  // Use segmented control style for all filters
  return (
    <View
      style={[
        styles.segmentedContainer,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      {filters.map((filter) => {
        const isSelected = selectedFilter === filter.key;
        return (
          <TouchableOpacity
            key={filter.key}
            style={[
              styles.segment,
              isSelected && {
                backgroundColor: colors.primary,
              },
            ]}
            onPress={() => onFilterChange(filter.key)}
            activeOpacity={0.7}
          >
            <ThemedText
              style={[
                styles.segmentText,
                {
                  color: isSelected ? '#FFFFFF' : colors.textSecondary,
                  fontWeight: isSelected ? '600' : '400',
                },
              ]}
            >
              {filter.label}
            </ThemedText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segmentedContainer: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.sm,
  },
  segmentText: {
    fontSize: 14,
  },
});
