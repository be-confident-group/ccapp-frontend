import React from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedText } from '@/components/themed-text';
import { Spacing, BorderRadius } from '@/constants/theme';

type GenderFilter = 'all' | 'male' | 'female' | 'other' | 'prefer_not_to_say';

interface GenderToggleProps {
  selected: GenderFilter;
  onToggle: (value: GenderFilter) => void;
}

export function GenderToggle({ selected, onToggle }: GenderToggleProps) {
  const { colors } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      style={styles.scrollView}
    >
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

      <TouchableOpacity
        style={[
          styles.option,
          selected === 'other' && {
            backgroundColor: colors.primary,
          },
        ]}
        onPress={() => onToggle('other')}
        activeOpacity={0.7}
      >
        <ThemedText
          style={[
            styles.optionText,
            {
              color: selected === 'other' ? '#FFFFFF' : colors.textSecondary,
              fontWeight: selected === 'other' ? '600' : '400',
            },
          ]}
        >
          Other
        </ThemedText>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.option,
          selected === 'prefer_not_to_say' && {
            backgroundColor: colors.primary,
          },
        ]}
        onPress={() => onToggle('prefer_not_to_say')}
        activeOpacity={0.7}
      >
        <ThemedText
          style={[
            styles.optionText,
            {
              color: selected === 'prefer_not_to_say' ? '#FFFFFF' : colors.textSecondary,
              fontWeight: selected === 'prefer_not_to_say' ? '600' : '400',
            },
          ]}
        >
          Prefer Not
        </ThemedText>
      </TouchableOpacity>
    </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flexGrow: 1,
  },
  scrollContent: {
    paddingRight: Spacing.sm,
  },
  container: {
    flexDirection: 'row',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  option: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.sm,
    minWidth: 70,
  },
  optionText: {
    fontSize: 11,
  },
});
