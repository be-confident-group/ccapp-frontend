import React, { useState, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/contexts/ThemeContext';
import { useUnits } from '@/contexts/UnitsContext';
import {
  LeaderboardHeader,
  FilterRow,
  ActivityToggle,
  SortToggle,
  GenderToggle,
  LeaderboardTable,
} from '@/components/leaderboard';
import {
  mockLeaderboardData,
  getLeaderboardWithCurrentUser,
} from '@/lib/utils/mockLeaderboardData';
import { Spacing } from '@/constants/theme';
import type { FeedGroup } from '@/types/feed';
import type { LeaderboardCategory } from '@/types/leaderboard';

type ActivityType = 'walks' | 'rides';
type SortBy = 'distance' | 'trips';
type GenderFilter = 'all' | 'male' | 'female';

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
  const [activityType, setActivityType] = useState<ActivityType>('rides'); // Default to rides
  const [sortBy, setSortBy] = useState<SortBy>('distance');
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('all');

  // Determine the category key based on current selections
  const categoryKey: LeaderboardCategory = useMemo(() => {
    if (genderFilter === 'male') {
      return 'male_rider';
    } else if (genderFilter === 'female') {
      return 'female_rider';
    } else {
      // All genders
      return `${activityType}_${sortBy}` as LeaderboardCategory;
    }
  }, [activityType, sortBy, genderFilter]);

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

    // Custom title based on filters
    let customTitle = '';
    if (genderFilter === 'male') {
      customTitle = activityType === 'rides' ? 'Top Male Riders' : 'Top Male Walkers';
    } else if (genderFilter === 'female') {
      customTitle = activityType === 'rides' ? 'Top Female Riders' : 'Top Female Walkers';
    } else {
      const activityLabel = activityType === 'rides' ? 'Riders' : 'Walkers';
      const sortLabel = sortBy === 'distance' ? 'Distance' : 'Trips';
      customTitle = `Top ${activityLabel} - ${sortLabel}`;
    }

    return {
      title: customTitle,
      valueType: data.valueType,
      valueLabel: label,
    };
  }, [leaderboardData, distanceUnit, activityType, sortBy, genderFilter]);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <ThemedView style={styles.container}>
        <LeaderboardHeader title={t('leaderboards.title')} />

        <View style={styles.topControlsRow}>
          <View style={styles.activityToggle}>
            <ActivityToggle selected={activityType} onToggle={setActivityType} />
          </View>

          <View style={styles.sortToggle}>
            <SortToggle selected={sortBy} onToggle={setSortBy} />
          </View>
        </View>

        <View style={styles.genderToggleContainer}>
          <GenderToggle selected={genderFilter} onToggle={setGenderFilter} />
        </View>

        <FilterRow
          selectedMonth={selectedMonth}
          onMonthChange={setSelectedMonth}
          selectedGroup={selectedGroup}
          onGroupChange={setSelectedGroup}
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
  topControlsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: 6,
    gap: Spacing.sm,
  },
  activityToggle: {
    flex: 1,
  },
  sortToggle: {
    flex: 1,
  },
  genderToggleContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 6,
  },
  tableContainer: {
    flex: 1,
  },
});
