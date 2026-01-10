import React, { useState, useMemo } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
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
import { Spacing } from '@/constants/theme';
import { useLeaderboard } from '@/lib/hooks/useLeaderboards';
import { useMyClubs } from '@/lib/hooks/useClubs';
import { leaderboardApi } from '@/lib/api/leaderboard';
import type { LeaderboardUser } from '@/types/leaderboard';
import type { Club } from '@/types/feed';

type ActivityType = 'walks' | 'rides';
type SortBy = 'distance' | 'trips';
type GenderFilter = 'all' | 'male' | 'female' | 'other' | 'prefer_not_to_say';

export default function LeaderboardsScreen() {
  const { t } = useTranslation('groups');
  const { colors } = useTheme();
  const { distanceUnit, kmToDistance } = useUnits();

  // Filter state
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null); // null = All Time
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);
  const [activityType, setActivityType] = useState<ActivityType>('rides');
  const [sortBy, setSortBy] = useState<SortBy>('distance');
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('all');

  // Fetch user's clubs for the dropdown
  const { data: myClubs } = useMyClubs();

  // Determine leaderboard type
  const leaderboardType = useMemo(() => {
    return leaderboardApi.getLeaderboardType(activityType, sortBy);
  }, [activityType, sortBy]);

  // Map frontend gender filter to backend codes
  const backendGenderCode = useMemo(() => {
    if (genderFilter === 'all') return null;
    const genderMap: Record<Exclude<GenderFilter, 'all'>, 'M' | 'F' | 'O' | 'P'> = {
      male: 'M',
      female: 'F',
      other: 'O',
      prefer_not_to_say: 'P',
    };
    return genderMap[genderFilter];
  }, [genderFilter]);

  // Fetch leaderboard data
  const { data: backendData, isLoading } = useLeaderboard(
    leaderboardType,
    selectedClub?.id || null,
    backendGenderCode
  );

  // Transform backend data to frontend format
  const leaderboardUsers = useMemo((): LeaderboardUser[] => {
    if (!backendData?.results) return [];

    return backendData.results.map((entry, index) => ({
      id: entry.id.toString(),
      rank: index + 1,
      firstName: entry.name,
      lastName: entry.last_name,
      avatarUrl: entry.profile_picture || undefined,
      value: sortBy === 'distance' ? kmToDistance(entry.value) : entry.value,
    }));
  }, [backendData, sortBy, kmToDistance]);

  // Get title and value label
  const { title, valueType, valueLabel } = useMemo(() => {
    let customTitle = '';

    // Gender-specific titles
    if (genderFilter === 'male') {
      customTitle = activityType === 'rides' ? 'Top Male Riders' : 'Top Male Walkers';
    } else if (genderFilter === 'female') {
      customTitle = activityType === 'rides' ? 'Top Female Riders' : 'Top Female Walkers';
    } else if (genderFilter === 'other') {
      customTitle = activityType === 'rides' ? 'Top Other Riders' : 'Top Other Walkers';
    } else if (genderFilter === 'prefer_not_to_say') {
      customTitle = activityType === 'rides' ? 'Top Riders (Prefer Not To Say)' : 'Top Walkers (Prefer Not To Say)';
    } else {
      // All genders
      const activityLabel = activityType === 'rides' ? 'Riders' : 'Walkers';
      const sortLabel = sortBy === 'distance' ? 'Distance' : 'Trips';
      customTitle = `Top ${activityLabel} - ${sortLabel}`;
    }

    let label = '';
    if (sortBy === 'trips') {
      label = 'Trips';
    } else {
      label = distanceUnit === 'km' ? 'Distance (km)' : 'Distance (mi)';
    }

    return {
      title: customTitle,
      valueType: sortBy,
      valueLabel: label,
    };
  }, [activityType, sortBy, distanceUnit, genderFilter]);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <ThemedView style={styles.container}>
        <LeaderboardHeader title={t('leaderboards.title', 'Community Board')} />

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
          selectedGroup={selectedClub}
          onGroupChange={setSelectedClub}
          myClubs={myClubs || []}
        />

        <View style={styles.tableContainer}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>
                Loading community board...
              </ThemedText>
            </View>
          ) : (
            <LeaderboardTable
              title={title}
              users={leaderboardUsers}
              valueType={valueType}
              valueLabel={valueLabel}
            />
          )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: 14,
  },
});
