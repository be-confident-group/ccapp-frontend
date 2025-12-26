import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { TrophyIcon, UserGroupIcon } from 'react-native-heroicons/outline';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { FeedGroup } from '@/types/feed';

interface FeedHeaderProps {
  onLeaderboardPress: () => void;
  onGroupSelectPress: () => void;
  selectedGroup?: FeedGroup | null;
}

export function FeedHeader({
  onLeaderboardPress,
  onGroupSelectPress,
}: FeedHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Title - Left */}
      <ThemedText style={styles.title}>Feed</ThemedText>

      {/* Icons - Right */}
      <View style={styles.iconsContainer}>
        {/* Leaderboard */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onLeaderboardPress}
          activeOpacity={0.7}
        >
          <TrophyIcon size={26} color={colors.icon} />
        </TouchableOpacity>

        {/* Group Selector */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onGroupSelectPress}
          activeOpacity={0.7}
        >
          <UserGroupIcon size={26} color={colors.icon} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
  },
  iconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
