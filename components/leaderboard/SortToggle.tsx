import React from 'react';
import { useTranslation } from 'react-i18next';
import { GlassTextSegments } from '@/components/ui/GlassTextSegments';

interface SortToggleProps {
  selected: 'distance' | 'trips';
  onToggle: (value: 'distance' | 'trips') => void;
}

export function SortToggle({ selected, onToggle }: SortToggleProps) {
  const { t } = useTranslation('groups');

  return (
    <GlassTextSegments
      stretch
      value={selected}
      onChange={onToggle}
      items={[
        { key: 'distance', label: t('leaderboards.filters.distance', 'Distance') },
        { key: 'trips', label: t('leaderboards.filters.trips', 'Trips') },
      ]}
    />
  );
}
