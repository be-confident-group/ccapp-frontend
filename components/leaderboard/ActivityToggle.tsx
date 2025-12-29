import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedText } from '@/components/themed-text';
import { Spacing, BorderRadius } from '@/constants/theme';

interface ActivityToggleProps {
  selected: 'walks' | 'rides';
  onToggle: (value: 'walks' | 'rides') => void;
}

export function ActivityToggle({ selected, onToggle }: ActivityToggleProps) {
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
          selected === 'walks' && {
            backgroundColor: colors.primary,
          },
        ]}
        onPress={() => onToggle('walks')}
        activeOpacity={0.7}
      >
        <ThemedText
          style={[
            styles.optionText,
            {
              color: selected === 'walks' ? '#FFFFFF' : colors.textSecondary,
              fontWeight: selected === 'walks' ? '600' : '400',
            },
          ]}
        >
          Walks
        </ThemedText>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.option,
          selected === 'rides' && {
            backgroundColor: colors.primary,
          },
        ]}
        onPress={() => onToggle('rides')}
        activeOpacity={0.7}
      >
        <ThemedText
          style={[
            styles.optionText,
            {
              color: selected === 'rides' ? '#FFFFFF' : colors.textSecondary,
              fontWeight: selected === 'rides' ? '600' : '400',
            },
          ]}
        >
          Rides
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
