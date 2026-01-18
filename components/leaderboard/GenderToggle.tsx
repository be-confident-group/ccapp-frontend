import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedText } from '@/components/themed-text';
import { Spacing, BorderRadius } from '@/constants/theme';

type GenderFilter = 'all' | 'male' | 'female';

interface GenderToggleProps {
  selected: GenderFilter;
  onToggle: (value: GenderFilter) => void;
}

export function GenderToggle({ selected, onToggle }: GenderToggleProps) {
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
          selected === 'all' && {
            backgroundColor: colors.primary,
          },
        ]}
        onPress={() => onToggle('all')}
        activeOpacity={0.7}
      >
        <ThemedText
          style={[
            styles.optionText,
            {
              color: selected === 'all' ? '#FFFFFF' : colors.textSecondary,
              fontWeight: selected === 'all' ? '600' : '400',
            },
          ]}
        >
          All
        </ThemedText>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.option,
          selected === 'male' && {
            backgroundColor: colors.primary,
          },
        ]}
        onPress={() => onToggle('male')}
        activeOpacity={0.7}
      >
        <ThemedText
          style={[
            styles.optionText,
            {
              color: selected === 'male' ? '#FFFFFF' : colors.textSecondary,
              fontWeight: selected === 'male' ? '600' : '400',
            },
          ]}
        >
          Male
        </ThemedText>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.option,
          selected === 'female' && {
            backgroundColor: colors.primary,
          },
        ]}
        onPress={() => onToggle('female')}
        activeOpacity={0.7}
      >
        <ThemedText
          style={[
            styles.optionText,
            {
              color: selected === 'female' ? '#FFFFFF' : colors.textSecondary,
              fontWeight: selected === 'female' ? '600' : '400',
            },
          ]}
        >
          Female
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
    gap: 4,
  },
  option: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.sm,
  },
  optionText: {
    fontSize: 11,
  },
});
