import React from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeftIcon } from 'react-native-heroicons/outline';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedText } from '@/components/themed-text';
import { GlassButton } from '@/components/ui/GlassButton';
import { Spacing } from '@/constants/theme';

interface LeaderboardHeaderProps {
  title: string;
}

export function LeaderboardHeader({ title }: LeaderboardHeaderProps) {
  const { colors } = useTheme();
  const { t } = useTranslation('common');

  return (
    <View style={styles.header}>
      <GlassButton onPress={() => router.back()} accessibilityLabel={t('buttons.back')}>
        <ChevronLeftIcon size={22} color={colors.glassTint} />
      </GlassButton>

      <ThemedText style={styles.headerTitle}>{title}</ThemedText>

      <View style={styles.placeholder} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    width: 44,
  },
});
