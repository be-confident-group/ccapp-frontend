import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { useTheme } from '@/contexts/ThemeContext';

/** Grouped-list caption (uppercase, small) used for month sections. */
export function TripSectionHeader({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <Text accessibilityRole="header" style={[styles.title, { color: colors.textSecondary }]}>
      {label.toUpperCase()}
    </Text>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 12,
    letterSpacing: 0.5,
    marginTop: 12,
    paddingHorizontal: 16,
  },
});
