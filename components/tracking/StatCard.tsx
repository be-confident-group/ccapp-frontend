import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Spacing, BorderRadius, FontSizes, FontWeights } from '@/constants/theme';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
  onPress?: () => void;
}

export default function StatCard({ icon, label, value, unit, onPress }: StatCardProps) {
  const { colors } = useTheme();

  const content = (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.iconContainer, { backgroundColor: colors.primary }]}>
        {icon}
      </View>

      <View style={styles.textContainer}>
        <View style={styles.valueContainer}>
          <Text style={[styles.value, { color: colors.text }]} numberOfLines={1}>
            {value}
          </Text>
          {unit && (
            <Text style={[styles.unit, { color: colors.textMuted }]}>
              {unit}
            </Text>
          )}
        </View>

        <Text style={[styles.label, { color: colors.textSecondary }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity style={styles.wrapper} onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={styles.wrapper}>{content}</View>;
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    minWidth: 150,
  },
  card: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 80,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  value: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
  },
  unit: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.regular,
  },
  label: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
  },
});
