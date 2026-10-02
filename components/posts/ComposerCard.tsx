import React, { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/contexts/ThemeContext';
import { FadeInUp } from './FadeInUp';

interface ComposerCardProps {
  /** Small uppercase caption above the card. */
  caption?: string;
  children: ReactNode;
  error?: string;
  /** Position on the screen, staggers the entrance. */
  index?: number;
  /** Remove inner padding (rows that own their own padding). */
  flush?: boolean;
}

/** Radius-20 card section for composer fields with a caption and inline error. */
export function ComposerCard({ caption, children, error, index = 0, flush = false }: ComposerCardProps) {
  const { colors } = useTheme();

  return (
    <FadeInUp index={index} style={styles.section}>
      {caption ? (
        <Text style={[styles.caption, { color: colors.textSecondary }]}>{caption.toUpperCase()}</Text>
      ) : null}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: error ? colors.error : 'transparent' },
          !flush && styles.padded,
        ]}
      >
        {children}
      </View>
      {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
    </FadeInUp>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 16, marginBottom: 20 },
  caption: { fontSize: 12, letterSpacing: 0.5, marginBottom: 8, paddingHorizontal: 16 },
  card: { borderRadius: 20, borderWidth: 1.5, overflow: 'hidden' },
  padded: { padding: 16, gap: 12 },
  error: { fontSize: 13, marginTop: 6, paddingHorizontal: 16 },
});
