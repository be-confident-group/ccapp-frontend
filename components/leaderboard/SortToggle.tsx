import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedText } from '@/components/themed-text';
import { Spacing, BorderRadius } from '@/constants/theme';

interface SortToggleProps {
  selected: 'distance' | 'trips';
  onToggle: (value: 'distance' | 'trips') => void;
}

export function SortToggle({ selected, onToggle }: SortToggleProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <TouchableOpacity
        style={[
          styles.option,
          selected === 'distance' && {
            backgroundColor: colors.primary,
          },
        ]}
        onPress={() => onToggle('distance')}
        activeOpacity={0.7}
      >
        <ThemedText
          style={[
            styles.optionText,
            {
              color: selected === 'distance' ? '#FFFFFF' : colors.textSecondary,
              fontWeight: selected === 'distance' ? '600' : '400',
            },
          ]}
        >
          Distance
        </ThemedText>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.option,
          selected === 'trips' && {
            backgroundColor: colors.primary,
          },
        ]}
        onPress={() => onToggle('trips')}
        activeOpacity={0.7}
      >
        <ThemedText
          style={[
            styles.optionText,
            {
              color: selected === 'trips' ? '#FFFFFF' : colors.textSecondary,
              fontWeight: selected === 'trips' ? '600' : '400',
            },
          ]}
        >
          Trips
        </ThemedText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: 4,
  },
  option: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.sm,
  },
  optionText: {
    fontSize: 14,
  },
});
