import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { TrophyIcon, MagnifyingGlassIcon, UsersIcon } from 'react-native-heroicons/outline';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

interface FeedHeaderProps {
  onLeaderboardPress: () => void;
  onMyClubsPress: () => void;
}

export function FeedHeader({
  onLeaderboardPress,
  onMyClubsPress,
}: FeedHeaderProps) {
  const { colors } = useTheme();

  const handleBrowseClubs = () => {
    router.push('/clubs/browse');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Title - Left */}
      <ThemedText style={styles.title}>Feed</ThemedText>

      {/* Icons - Right */}
      <View style={styles.iconsContainer}>
        {/* Browse Clubs */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={handleBrowseClubs}
          activeOpacity={0.7}
        >
          <MagnifyingGlassIcon size={24} color={colors.icon} />
        </TouchableOpacity>

        {/* Leaderboard */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onLeaderboardPress}
          activeOpacity={0.7}
        >
          <TrophyIcon size={24} color={colors.icon} />
        </TouchableOpacity>

        {/* My Clubs */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onMyClubsPress}
          activeOpacity={0.7}
        >
          <UsersIcon size={24} color={colors.icon} />
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
