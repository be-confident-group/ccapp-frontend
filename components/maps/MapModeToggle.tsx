import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { GlassSegmentedControl } from '@/components/ui/GlassSegmentedControl';
import { useTheme } from '@/contexts/ThemeContext';
import type { MapViewMode } from '@/types/mapMode';

interface MapModeToggleProps {
  activeMode: MapViewMode;
  onModeChange: (mode: MapViewMode) => void;
}

export function MapModeToggle({ activeMode, onModeChange }: MapModeToggleProps) {
  const { t } = useTranslation('maps');
  const { colors } = useTheme();

  const modes: MapViewMode[] = ['heatmap', 'feedback'];

  return (
    <GlassSegmentedControl
      value={activeMode}
      onChange={onModeChange}
      activeColor={colors.glassActiveFill}
      segmentWidth={98}
      segmentHeight={36}
      segments={modes.map((mode) => ({
        key: mode,
        accessibilityLabel: t(`tabs.${mode}`),
        render: (active) => (
          <Text style={[styles.label, { color: active ? '#FFFFFF' : colors.glassInactive }]}>
            {t(`tabs.${mode}`)}
          </Text>
        ),
      }))}
    />
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
});
