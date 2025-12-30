/**
 * FeelingSelector Component
 *
 * A 2x2 grid of feeling buttons for route rating.
 * Users select a feeling before painting route segments.
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { Spacing } from '@/constants/theme';
import {
  FeelingType,
  FEELING_ORDER,
  FEELINGS,
  getFeelingColor,
  getFeelingBackgroundColor,
} from '@/types/rating';

interface FeelingSelectorProps {
  selectedFeeling: FeelingType | null;
  onSelect: (feeling: FeelingType) => void;
  disabled?: boolean;
  style?: ViewStyle;
  compact?: boolean;
}

export default function FeelingSelector({
  selectedFeeling,
  onSelect,
  disabled = false,
  style,
  compact = false,
}: FeelingSelectorProps) {
  const { colors } = useTheme();

  if (compact) {
    return (
      <View style={[styles.compactContainer, style]}>
        <View style={styles.compactRow}>
          {FEELING_ORDER.map((feelingType) => {
            const feeling = FEELINGS[feelingType];
            const isSelected = selectedFeeling === feelingType;
            const feelingColor = getFeelingColor(feelingType);
            const backgroundColor = getFeelingBackgroundColor(feelingType);

            return (
              <TouchableOpacity
                key={feelingType}
                style={[
                  styles.compactButton,
                  {
                    backgroundColor: isSelected ? feelingColor : backgroundColor,
                    borderColor: feelingColor,
                    borderWidth: isSelected ? 0 : 1.5,
                    opacity: disabled ? 0.5 : 1,
                  },
                ]}
                onPress={() => onSelect(feelingType)}
                disabled={disabled}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons
                  name={feeling.icon as any}
                  size={20}
                  color={isSelected ? '#FFFFFF' : feelingColor}
                />
                <ThemedText
                  style={[
                    styles.compactLabel,
                    { color: isSelected ? '#FFFFFF' : feelingColor },
                  ]}
                  numberOfLines={1}
                >
                  {feeling.label}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <ThemedText style={styles.title}>Select a feeling, then paint</ThemedText>
      <View style={styles.grid}>
        {FEELING_ORDER.map((feelingType) => {
          const feeling = FEELINGS[feelingType];
          const isSelected = selectedFeeling === feelingType;
          const feelingColor = getFeelingColor(feelingType);
          const backgroundColor = getFeelingBackgroundColor(feelingType);

          return (
            <TouchableOpacity
              key={feelingType}
              style={[
                styles.button,
                {
                  backgroundColor: isSelected ? feelingColor : backgroundColor,
                  borderColor: feelingColor,
                  borderWidth: isSelected ? 0 : 2,
                  opacity: disabled ? 0.5 : 1,
                },
              ]}
              onPress={() => onSelect(feelingType)}
              disabled={disabled}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name={feeling.icon as any}
                size={32}
                color={isSelected ? '#FFFFFF' : feelingColor}
              />
              <ThemedText
                style={[
                  styles.label,
                  { color: isSelected ? '#FFFFFF' : feelingColor },
                ]}
              >
                {feeling.label}
              </ThemedText>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.md,
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  button: {
    width: '48%',
    flexGrow: 1,
    flexBasis: '45%',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    minHeight: 80,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  // Compact styles for single row
  compactContainer: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  compactRow: {
    flexDirection: 'row',
    gap: 8,
  },
  compactButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  compactLabel: {
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
  },
});
