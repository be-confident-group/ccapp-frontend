import React from 'react';
import { useTranslation } from 'react-i18next';
import { GlassTextSegments } from '@/components/ui/GlassTextSegments';

interface ActivityToggleProps {
  selected: 'walks' | 'rides';
  onToggle: (value: 'walks' | 'rides') => void;
}

export function ActivityToggle({ selected, onToggle }: ActivityToggleProps) {
  const { t } = useTranslation('groups');

  return (
    <GlassTextSegments
      stretch
      value={selected}
      onChange={onToggle}
      items={[
        { key: 'walks', label: t('leaderboards.tabs.walks', 'Walks') },
        { key: 'rides', label: t('leaderboards.tabs.rides', 'Rides') },
      ]}
    />
  );
}
