import React from 'react';
import { useTranslation } from 'react-i18next';
import { GlobeAltIcon, UserIcon } from 'react-native-heroicons/outline';

import { GlassSegmentedControl } from '@/components/ui/GlassSegmentedControl';
import { useTheme } from '@/contexts/ThemeContext';
import type { FeedbackMode, HeatmapMode } from '@/types/mapMode';

interface MapSubModeToggleProps {
  mode: 'heatmap' | 'feedback';
  activeSubMode: HeatmapMode | FeedbackMode;
  onSubModeChange: (subMode: HeatmapMode | FeedbackMode) => void;
}

export function MapSubModeToggle({ mode, activeSubMode, onSubModeChange }: MapSubModeToggleProps) {
  const { t } = useTranslation('maps');
  const { colors } = useTheme();

  const subModes: { key: HeatmapMode | FeedbackMode; icon: typeof GlobeAltIcon; label: string }[] =
    mode === 'heatmap'
      ? [
          { key: 'global', icon: GlobeAltIcon, label: t('controls.global') },
          { key: 'personal', icon: UserIcon, label: t('controls.myHeatmap') },
        ]
      : [
          { key: 'community', icon: GlobeAltIcon, label: t('controls.community') },
          { key: 'personal', icon: UserIcon, label: t('controls.myFeedback') },
        ];

  return (
    <GlassSegmentedControl
      orientation="vertical"
      value={activeSubMode}
      onChange={onSubModeChange}
      activeColor={colors.accent}
      segmentWidth={36}
      segmentHeight={36}
      segments={subModes.map(({ key, icon: Icon, label }) => ({
        key,
        accessibilityLabel: label,
        // Dark icon on the gold highlight for contrast in both themes.
        render: (active) => <Icon size={20} color={active ? '#000000' : colors.glassInactive} />,
      }))}
    />
  );
}
