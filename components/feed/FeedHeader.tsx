import React from 'react';
import { View, StyleSheet } from 'react-native';
import { TrophyIcon, UsersIcon } from 'react-native-heroicons/outline';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { GlassActionGroup } from '@/components/ui/GlassActionGroup';
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
  const { t: tc } = useTranslation('common');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Title - Left */}
      <ThemedText style={styles.title}>{t('title')}</ThemedText>

      <GlassActionGroup
        actions={[
          { key: 'leaderboards', icon: TrophyIcon, accessibilityLabel: tc('headerActions.leaderboards'), onPress: onLeaderboardPress },
          { key: 'clubs', icon: UsersIcon, accessibilityLabel: tc('headerActions.myClubs'), onPress: onMyClubsPress },
        ]}
      />
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
});
