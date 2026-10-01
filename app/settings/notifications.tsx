import React, { useCallback, useState } from 'react';
import { Switch } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChatBubbleLeftIcon,
  HeartIcon,
  UserGroupIcon,
  UserPlusIcon,
} from 'react-native-heroicons/solid';
import { SettingsGroup } from '@/components/profile/SettingsGroup';
import { SettingsItem } from '@/components/profile/SettingsItem';
import { SettingsScreen, SettingsFootnote } from '@/components/settings/SettingsScreen';
import { useTheme } from '@/contexts/ThemeContext';
import { showErrorAlert } from '@/lib/utils/alert';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from '@/lib/api/notifications';

type PrefKey = keyof NotificationPreferences;

export default function NotificationPreferencesScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [optimisticOverrides, setOptimisticOverrides] = useState<Partial<NotificationPreferences>>({});

  const prefRows = [
    {
      key: 'likes' as PrefKey,
      Icon: HeartIcon,
      tint: '#FF3B30',
      label: t('groups:notificationPreferences.likes.label'),
      subtitle: t('groups:notificationPreferences.likes.subtitle'),
    },
    {
      key: 'comments' as PrefKey,
      Icon: ChatBubbleLeftIcon,
      tint: '#007AFF',
      label: t('groups:notificationPreferences.comments.label'),
      subtitle: t('groups:notificationPreferences.comments.subtitle'),
    },
    {
      key: 'club_activity' as PrefKey,
      Icon: UserGroupIcon,
      tint: '#34C759',
      label: t('groups:notificationPreferences.club_activity.label'),
      subtitle: t('groups:notificationPreferences.club_activity.subtitle'),
    },
    {
      key: 'join_requests' as PrefKey,
      Icon: UserPlusIcon,
      tint: '#FF9500',
      label: t('groups:notificationPreferences.join_requests.label'),
      subtitle: t('groups:notificationPreferences.join_requests.subtitle'),
    },
  ];

  const { data: prefs, isLoading } = useQuery<NotificationPreferences>({
    queryKey: ['notification-preferences'],
    queryFn: getNotificationPreferences,
    staleTime: 1000 * 60 * 5,
  });

  const mutation = useMutation({
    mutationFn: (updated: Partial<NotificationPreferences>) =>
      updateNotificationPreferences(updated),
    onSuccess: (data) => {
      queryClient.setQueryData<NotificationPreferences>(['notification-preferences'], data);
      setOptimisticOverrides({});
    },
    onError: (_err, variables) => {
      // Revert the optimistic toggle by clearing overrides for changed keys
      setOptimisticOverrides((prev) => {
        const reverted = { ...prev };
        for (const key of Object.keys(variables) as PrefKey[]) {
          delete reverted[key];
        }
        return reverted;
      });
      showErrorAlert('generic');
    },
  });

  const handleToggle = useCallback(
    (key: PrefKey, value: boolean) => {
      if (!prefs) return;
      // Apply optimistic override immediately
      setOptimisticOverrides((prev) => ({ ...prev, [key]: value }));
      mutation.mutate({ ...prefs, [key]: value });
    },
    [prefs, mutation]
  );

  const isOn = (key: PrefKey) =>
    key in optimisticOverrides ? (optimisticOverrides[key] ?? false) : (prefs?.[key] ?? false);

  return (
    <SettingsScreen title={t('profile:notifications.title')} loading={isLoading}>
      <SettingsGroup>
        {prefRows.map((row, index) => (
          <SettingsItem
            key={row.key}
            grouped
            icon={<row.Icon size={18} color="#FFFFFF" />}
            iconColor={row.tint}
            title={row.label}
            subtitle={row.subtitle}
            isLast={index === prefRows.length - 1}
            rightElement={
              <Switch
                value={isOn(row.key)}
                onValueChange={(val) => handleToggle(row.key, val)}
                disabled={mutation.isPending}
                trackColor={{ false: colors.border, true: colors.trackingActive }}
                ios_backgroundColor={colors.border}
              />
            }
          />
        ))}
      </SettingsGroup>
      <SettingsFootnote>
        {t('profile:notifications.subtitle')}
      </SettingsFootnote>
    </SettingsScreen>
  );
}
