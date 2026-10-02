import React, { type ComponentType } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { useTheme } from '@/contexts/ThemeContext';

interface TripsEmptyStateProps {
  icon: ComponentType<{ size?: number; color?: string }>;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Centred empty state: plain icon in a 64px circle, title, short text and optional primary action. */
export function TripsEmptyState({ icon: Icon, title, message, actionLabel, onAction }: TripsEmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <View style={[styles.circle, { backgroundColor: colors.glassHighlight }]}>
        <Icon size={28} color={colors.glassTint} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {message ? <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} variant="primary" style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 64,
    gap: 8,
  },
  circle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  action: {
    marginTop: 12,
  },
});
