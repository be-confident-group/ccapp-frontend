import React, { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChevronRightIcon } from 'react-native-heroicons/mini';

import { useTheme } from '@/contexts/ThemeContext';
import { PressableScale } from './PressableScale';

interface SelectorRowProps {
  /** Selected value; when empty the placeholder is shown muted. */
  value?: string;
  placeholder: string;
  leading?: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
}

/** Value + chevron row that opens a picker (GlassSheet / GlassMenu). */
export function SelectorRow({ value, placeholder, leading, onPress, accessibilityLabel }: SelectorRowProps) {
  const { colors } = useTheme();

  return (
    <PressableScale scaleTo={0.98} onPress={onPress} accessibilityLabel={accessibilityLabel} style={styles.row}>
      {leading}
      <View style={styles.flex}>
        <Text
          style={[styles.value, { color: value ? colors.text : colors.textMuted }]}
          numberOfLines={1}
        >
          {value || placeholder}
        </Text>
      </View>
      <ChevronRightIcon size={20} color={colors.textMuted} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, minHeight: 56 },
  flex: { flex: 1 },
  value: { fontSize: 16, fontWeight: '500' },
});
