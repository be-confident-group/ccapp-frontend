import React from 'react';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { GlassSegmentedControl } from '@/components/ui/GlassSegmentedControl';
import { useTheme } from '@/contexts/ThemeContext';

interface GlassTextSegmentsProps<K extends string> {
  items: { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
  /** Fill the parent's width, splitting it equally between segments. */
  stretch?: boolean;
  fontSize?: number;
}

/** Text-only glass segmented control with content-sized (or equal) segments. */
export function GlassTextSegments<K extends string>({
  items,
  value,
  onChange,
  stretch = false,
  fontSize = 14,
}: GlassTextSegmentsProps<K>) {
  const { colors } = useTheme();

  return (
    <GlassSegmentedControl
      value={value}
      onChange={onChange}
      activeColor={colors.glassActiveFill}
      stretch={stretch}
      segments={items.map(({ key, label }) => ({
        key,
        accessibilityLabel: label,
        render: (active) => (
          <ThemedText
            numberOfLines={1}
            style={[
              styles.label,
              { fontSize, color: active ? '#FFFFFF' : colors.glassInactive },
              active && styles.labelActive,
            ]}
          >
            {label}
          </ThemedText>
        ),
      }))}
    />
  );
}

const styles = StyleSheet.create({
  label: {
    fontWeight: '500',
  },
  labelActive: {
    fontWeight: '600',
  },
});
