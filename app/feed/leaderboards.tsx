import React, { useState, useMemo, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/contexts/ThemeContext';
import { useUnits } from '@/contexts/UnitsContext';
import {
  LeaderboardHeader,
  FilterRow,
  CategoryTabs,
  SubFilterChips,
  LeaderboardTable,
} from '@/components/leaderboard';
import {
  mockLeaderboardData,
  getLeaderboardWithCurrentUser,
} from '@/lib/utils/mockLeaderboardData';
import type { FeedGroup } from '@/types/feed';
import type {
  MainTab,
  RidesWalksSubFilter,
  GenderSubFilter,
  LeaderboardCategory,
} from '@/types/leaderboard';

export default function LeaderboardsScreen() {
  const { t } = useTranslation('groups');
  const { colors } = useTheme();
  const { distanceUnit } = useUnits();

  // Filter state
  const [selectedMonth, setSelectedMonth] = useState<string | null>(
    // Default to current month
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  );
  const [selectedGroup, setSelectedGroup] = useState<FeedGroup | null>(null);
  const [mainTab, setMainTab] = useState<MainTab>('rides');
  const [ridesWalksFilter, setRidesWalksFilter] = useState<RidesWalksSubFilter>('distance');
  const [genderFilter, setGenderFilter] = useState<GenderSubFilter>('male');

  // Get current sub-filter based on main tab
  const currentSubFilter = mainTab === 'gender' ? genderFilter : ridesWalksFilter;

  // Handle sub-filter change
  const handleSubFilterChange = useCallback(
    (filter: RidesWalksSubFilter | GenderSubFilter) => {
      if (mainTab === 'gender') {
        setGenderFilter(filter as GenderSubFilter);
      } else {
        setRidesWalksFilter(filter as RidesWalksSubFilter);
      }
    },
    [mainTab]
  );

  // Handle main tab change - reset sub-filter to default
  const handleMainTabChange = useCallback((tab: MainTab) => {
    setMainTab(tab);
    if (tab === 'gender') {
      setGenderFilter('male');
    } else {
      setRidesWalksFilter('distance');
    }
  }, []);

  // Determine the category key based on current selections
  const categoryKey: LeaderboardCategory = useMemo(() => {
    if (mainTab === 'gender') {
      switch (genderFilter) {
        case 'male':
          return 'male_rider';
        case 'female':
          return 'female_rider';
        case 'new_male':
          return 'new_male_rider';
        case 'new_female':
          return 'new_female_rider';
      }
    } else {
      return `${mainTab}_${ridesWalksFilter}` as LeaderboardCategory;
    }
  }, [mainTab, ridesWalksFilter, genderFilter]);

  // Get leaderboard data
  const leaderboardData = useMemo(() => {
    const data = mockLeaderboardData[categoryKey];
    if (!data) return null;

    // Get users with current user highlighted
    const users = getLeaderboardWithCurrentUser(categoryKey, 5);

    return {
      ...data,
      users,
    };
  }, [categoryKey]);

  // Get title and value label
  const { title, valueType, valueLabel } = useMemo(() => {
    const data = leaderboardData;
    if (!data) {
      return { title: '', valueType: 'distance' as const, valueLabel: 'Distance' };
    }

    let label = 'Distance';
    if (data.valueType === 'trips') {
      label = 'Trips';
    } else {
      label = distanceUnit === 'km' ? 'Distance (km)' : 'Distance (mi)';
    }

    return {
      title: data.title,
      valueType: data.valueType,
      valueLabel: label,
    };
  }, [leaderboardData, distanceUnit]);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <ThemedView style={styles.container}>
        <LeaderboardHeader title={t('leaderboards.title')} />

        <FilterRow
          selectedMonth={selectedMonth}
          onMonthChange={setSelectedMonth}
          selectedGroup={selectedGroup}
          onGroupChange={setSelectedGroup}
        />

        <CategoryTabs selectedTab={mainTab} onTabChange={handleMainTabChange} />

        <SubFilterChips
          mainTab={mainTab}
          selectedFilter={currentSubFilter}
          onFilterChange={handleSubFilterChange}
        />

        <View style={styles.tableContainer}>
          <LeaderboardTable
            title={title}
            users={leaderboardData?.users || []}
            valueType={valueType}
            valueLabel={valueLabel}
          />
        </View>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  tableContainer: {
    flex: 1,
  },
});
