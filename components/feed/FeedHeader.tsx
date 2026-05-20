import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { TrophyIcon, UsersIcon } from 'react-native-heroicons/outline';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedText } from '@/components/themed-text';
import { Spacing, FontSizes } from '@/constants/theme';

interface FeedHeaderProps {
  onLeaderboardPress: () => void;
  onMyClubsPress: () => void;
}

export function FeedHeader({
  onLeaderboardPress,
  onMyClubsPress,
}: FeedHeaderProps) {
  const { colors } = useTheme();
  const { t } = useTranslation('groups');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Title - Left */}
      <ThemedText style={styles.title}>{t('title')}</ThemedText>

      {/* Icons - Right */}
      <View style={styles.iconsContainer}>
        {/* Community Board */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onLeaderboardPress}
          activeOpacity={0.7}
        >
          <TrophyIcon size={28} color={colors.icon} />
        </TouchableOpacity>

        {/* My Groups */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onMyClubsPress}
          activeOpacity={0.7}
        >
          <UsersIcon size={28} color={colors.icon} />
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
    fontSize: FontSizes.xl,
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
