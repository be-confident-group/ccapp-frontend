import React from 'react';
import { View, TouchableOpacity, StyleSheet, ActionSheetIOS, Platform, Alert } from 'react-native';
import { ChevronDownIcon } from 'react-native-heroicons/outline';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedText } from '@/components/themed-text';
import { Spacing, BorderRadius } from '@/constants/theme';
import type { MainTab, RidesWalksSubFilter, GenderSubFilter } from '@/types/leaderboard';

interface CategoryTabsWithFilterProps {
  selectedTab: MainTab;
  onTabChange: (tab: MainTab) => void;
  selectedFilter: RidesWalksSubFilter | GenderSubFilter;
  onFilterChange: (filter: RidesWalksSubFilter | GenderSubFilter) => void;
}

const TABS: { key: MainTab; label: string }[] = [
  { key: 'rides', label: 'Rides' },
  { key: 'walks', label: 'Walks' },
  { key: 'gender', label: 'Gender' },
];

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

export function CategoryTabsWithFilter({
  selectedTab,
  onTabChange,
  selectedFilter,
  onFilterChange,
}: CategoryTabsWithFilterProps) {
  const { colors } = useTheme();

  const getFilterLabel = () => {
    if (selectedTab === 'gender') {
      const filter = GENDER_FILTERS.find((f) => f.key === selectedFilter);
      return filter?.label || 'Top Male';
    }
    const filter = RIDES_WALKS_FILTERS.find((f) => f.key === selectedFilter);
    return filter?.label || 'Distance';
  };

  const handleFilterPress = () => {
    const filters = selectedTab === 'gender' ? GENDER_FILTERS : RIDES_WALKS_FILTERS;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', ...filters.map((f) => f.label)],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex > 0) {
            const selected = filters[buttonIndex - 1];
            onFilterChange(selected.key);
          }
        }
      );
    } else {
      Alert.alert(
        'Select Filter',
        '',
        [
          ...filters.map((f) => ({
            text: f.label,
            onPress: () => onFilterChange(f.key),
          })),
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* Main Tabs */}
      <View
        style={[
          styles.tabsContainer,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        {TABS.map((tab) => {
          const isSelected = selectedTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tab,
                isSelected && {
                  backgroundColor: colors.primary,
                },
              ]}
              onPress={() => onTabChange(tab.key)}
              activeOpacity={0.7}
            >
              <ThemedText
                style={[
                  styles.tabText,
                  {
                    color: isSelected ? '#FFFFFF' : colors.textSecondary,
                    fontWeight: isSelected ? '600' : '400',
                  },
                ]}
              >
                {tab.label}
              </ThemedText>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Filter Dropdown */}
      <TouchableOpacity
        style={[
          styles.filterButton,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
        onPress={handleFilterPress}
        activeOpacity={0.7}
      >
        <ThemedText style={styles.filterText} numberOfLines={1}>
          {getFilterLabel()}
        </ThemedText>
        <ChevronDownIcon size={16} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.sm,
  },
  tabText: {
    fontSize: 14,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 14,
    flex: 1,
  },
});
