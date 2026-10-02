import React, { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Button from '@/components/ui/Button';
import { useTheme } from '@/contexts/ThemeContext';
import { FadeInUp } from './FadeInUp';

interface PostsEmptyStateProps {
  /** Plain heroicon element, rendered in colors.glassTint. */
  icon: (color: string) => ReactNode;
  title?: string;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Centred empty state: plain icon in a 64px circle, title, text and an optional action. */
export function PostsEmptyState({ icon, title, text, actionLabel, onAction }: PostsEmptyStateProps) {
  const { colors } = useTheme();

  return (
    <FadeInUp style={styles.container}>
      <View style={[styles.circle, { backgroundColor: colors.glassHighlight }]}>{icon(colors.glassTint)}</View>
      {title ? <Text style={[styles.title, { color: colors.text }]}>{title}</Text> : null}
      <Text style={[styles.text, { color: colors.textSecondary }]}>{text}</Text>
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} variant="primary" style={styles.action} />
      ) : null}
    </FadeInUp>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingHorizontal: 32, gap: 8 },
  circle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  text: { fontSize: 15, lineHeight: 21, textAlign: 'center' },
  action: { marginTop: 12 },
});
