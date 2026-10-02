import React from 'react';
import { Cog6ToothIcon } from 'react-native-heroicons/outline';
import { useTranslation } from 'react-i18next';
import { PostsScreen } from '@/components/posts/PostsScreen';
import { PostsEmptyState } from '@/components/posts/PostsEmptyState';

export default function FeedSettingsScreen() {
  const { t } = useTranslation(['groups', 'feed']);

  return (
    <PostsScreen title={t('settings.title')} scroll={false}>
      <PostsEmptyState
        icon={(color) => <Cog6ToothIcon size={28} color={color} />}
        title={t('settings.comingSoon')}
        text={t('feed:settings.placeholder')}
      />
    </PostsScreen>
  );
}
