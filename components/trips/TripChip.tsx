import React, { type ComponentType } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/contexts/ThemeContext';

interface TripChipProps {
  label: string;
  icon?: ComponentType<{ size?: number; color?: string }>;
  /** Text/icon colour; defaults to the secondary text colour on a neutral chip. */
  tone?: string;
}

/** Small status pill (Manual, Not synced, Confirmed...). Neutral unless a tone is given. */
export function TripChip({ label, icon: Icon, tone }: TripChipProps) {
  const { colors } = useTheme();
  const color = tone ?? colors.textSecondary;
  return (
    <View style={[styles.chip, { backgroundColor: tone ? tone + '1F' : colors.glassHighlight }]}>
      {Icon ? <Icon size={12} color={color} /> : null}
      <Text style={[styles.text, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
  },
});
