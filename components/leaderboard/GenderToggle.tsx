import React from 'react';
import { useTranslation } from 'react-i18next';
import { GlassTextSegments } from '@/components/ui/GlassTextSegments';

type GenderFilter = 'all' | 'male' | 'female';

interface GenderToggleProps {
  selected: GenderFilter;
  onToggle: (value: GenderFilter) => void;
}

export function GenderToggle({ selected, onToggle }: GenderToggleProps) {
  const { t } = useTranslation('groups');

  return (
    <GlassTextSegments
      stretch
      value={selected}
      onChange={onToggle}
      items={[
        { key: 'all', label: t('leaderboards.gender.all', 'All') },
        { key: 'male', label: t('leaderboards.gender.male', 'Male') },
        { key: 'female', label: t('leaderboards.gender.female', 'Female') },
      ]}
    />
  );
}
