import React from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { TrophyIcon } from 'react-native-heroicons/outline';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { LeaderboardRow } from './LeaderboardRow';
import type { LeaderboardUser } from '@/types/leaderboard';

interface LeaderboardTableProps {
  title: string;
  users: LeaderboardUser[];
  valueType: 'distance' | 'trips';
  valueLabel: string;
}

export function LeaderboardTable({
  title,
  users,
  valueType,
  valueLabel,
}: LeaderboardTableProps) {
  const { colors } = useTheme();

  const renderHeader = () => (
    <View>
      {/* Category Title */}
      <View style={styles.titleContainer}>
        <TrophyIcon size={20} color={colors.accent} />
        <ThemedText style={styles.title}>{title}</ThemedText>
      </View>

      {/* Table Header */}
      <View
        style={[
          styles.tableHeader,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <ThemedText
          style={[styles.headerText, styles.headerRank, { color: colors.textSecondary }]}
        >
          #
        </ThemedText>
        <ThemedText
          style={[styles.headerText, styles.headerName, { color: colors.textSecondary }]}
        >
          Name
        </ThemedText>
        <ThemedText
          style={[styles.headerText, styles.headerValue, { color: colors.textSecondary }]}
        >
          {valueLabel}
        </ThemedText>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <TrophyIcon size={48} color={colors.textMuted} />
      <ThemedText style={[styles.emptyText, { color: colors.textMuted }]}>
        No data for this period
      </ThemedText>
    </View>
  );

  return (
    <FlatList
      data={users}
      keyExtractor={(item) => item.id}
      renderItem={({ item, index }) => (
        <LeaderboardRow user={item} valueType={valueType} index={index} />
      )}
      ListHeaderComponent={renderHeader}
      ListEmptyComponent={renderEmpty}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.listContent}
    />
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
  },
  headerText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  headerRank: {
    width: 40,
    textAlign: 'center',
  },
  headerName: {
    flex: 1,
    marginLeft: 36 + Spacing.sm, // avatar width + margin
  },
  headerValue: {
    textAlign: 'right',
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: Spacing.xl,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 16,
  },
});
