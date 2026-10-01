import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GlassTextSegments } from '@/components/ui/GlassTextSegments';
import { Spacing } from '@/constants/theme';
import type { MainTab } from '@/types/leaderboard';

interface CategoryTabsProps {
  selectedTab: MainTab;
  onTabChange: (tab: MainTab) => void;
}

export function CategoryTabs({ selectedTab, onTabChange }: CategoryTabsProps) {
  const { t } = useTranslation('groups');

  return (
    <View style={styles.container}>
      <GlassTextSegments
        stretch
        value={selectedTab}
        onChange={onTabChange}
        items={[
          { key: 'rides', label: t('leaderboards.tabs.rides', 'Rides') },
          { key: 'walks', label: t('leaderboards.tabs.walks', 'Walks') },
          { key: 'gender', label: t('leaderboards.tabs.gender', 'Gender') },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: Spacing.lg,
  },
});
