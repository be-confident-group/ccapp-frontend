import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BellIcon, BoltIcon, HeartIcon, MapIcon, MapPinIcon } from 'react-native-heroicons/solid';
import { SettingsGroup } from '@/components/profile/SettingsGroup';
import { SettingsItem } from '@/components/profile/SettingsItem';
import { SettingsScreen } from '@/components/settings/SettingsScreen';
import Button from '@/components/ui/Button';
import { useTheme } from '@/contexts/ThemeContext';
import {
  checkAll,
  openAppSettings,
  requestLocationBackground,
  requestLocationForeground,
  requestMotion,
  requestNotifications,
  type PermissionResult,
} from '@/lib/permissions/wizard';

type PermissionKey = 'locationForeground' | 'locationBackground' | 'motion' | 'notifications';
type PermissionStatuses = Record<PermissionKey, PermissionResult['status']>;

const DEFAULT_STATUSES: PermissionStatuses = {
  locationForeground: 'undetermined',
  locationBackground: 'undetermined',
  motion: 'undetermined',
  notifications: 'undetermined',
};

type IconComponent = React.ComponentType<{ size: number; color: string }>;

const PERMISSION_ICONS: Record<PermissionKey, IconComponent> = {
  locationForeground: MapPinIcon,
  locationBackground: MapIcon,
  motion: BoltIcon,
  notifications: BellIcon,
};

const PERMISSION_TINTS: Record<PermissionKey, string> = {
  locationForeground: '#007AFF',
  locationBackground: '#5856D6',
  motion: '#FF9500',
  notifications: '#FF3B30',
};

const PERMISSION_REQUIRED: Record<PermissionKey, boolean> = {
  locationForeground: true,
  locationBackground: true,
  motion: true,
  notifications: false,
};

export default function PermissionsScreen() {
  const { t } = useTranslation('onboarding');
  const { colors } = useTheme();
  const [statuses, setStatuses] = useState<PermissionStatuses>(DEFAULT_STATUSES);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState<PermissionKey | null>(null);
  const prevAppState = useRef<AppStateStatus>(AppState.currentState);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const all = await checkAll();
      setStatuses(all as PermissionStatuses);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (prevAppState.current !== 'active' && nextState === 'active') {
        refresh();
      }
      prevAppState.current = nextState;
    });
    return () => sub.remove();
  }, [refresh]);

  async function handleRequest(key: PermissionKey) {
    setRequesting(key);
    try {
      switch (key) {
        case 'locationForeground': await requestLocationForeground(); break;
        case 'locationBackground': await requestLocationBackground(); break;
        case 'motion': await requestMotion(); break;
        case 'notifications': await requestNotifications(); break;
      }
      await refresh();
    } finally {
      setRequesting(null);
    }
  }

  const rows: { key: PermissionKey; translationKey: string }[] = [
    { key: 'locationForeground', translationKey: 'locationFg' },
    { key: 'locationBackground', translationKey: 'locationBg' },
    { key: 'motion', translationKey: 'motion' },
    { key: 'notifications', translationKey: 'notifications' },
  ];

  function statusColor(status: PermissionResult['status']): string {
    if (status === 'granted') return colors.success;
    if (status === 'denied') return colors.error;
    return colors.textMuted;
  }

  function statusLabel(status: PermissionResult['status']): string {
    if (status === 'granted') return t('permissionsScreen.granted');
    if (status === 'denied') return t('permissionsScreen.denied');
    return t('permissionsScreen.notDetermined');
  }

  function needsSettings(key: PermissionKey, status: PermissionResult['status']): boolean {
    if (key === 'locationBackground' && Platform.OS === 'android') return true;
    return status === 'denied';
  }

  return (
    <SettingsScreen title={t('permissionsScreen.title')} loading={loading}>
      <Text style={[styles.intro, { color: colors.textSecondary }]}>
        {t('permissionsScreen.subtitle')}
      </Text>
      <SettingsGroup>
        {rows.map(({ key, translationKey }, index) => {
          const status = statuses[key];
          const isGranted = status === 'granted';
          const required = PERMISSION_REQUIRED[key];
          const PermIcon = PERMISSION_ICONS[key];
          const opensSettings = needsSettings(key, status);

          return (
            <SettingsItem
              key={key}
              grouped
              icon={<PermIcon size={18} color="#FFFFFF" />}
              iconColor={PERMISSION_TINTS[key]}
              title={t(`permissionsScreen.${translationKey}.name`)}
              isLast={index === rows.length - 1}
              rightElement={
                isGranted ? undefined : (
                  <Button
                    title={
                      opensSettings
                        ? t('permissionsScreen.openSettings')
                        : t('permissionsScreen.request')
                    }
                    onPress={() => (opensSettings ? openAppSettings() : handleRequest(key))}
                    variant="glass"
                    size="small"
                    loading={requesting === key}
                  />
                )
              }
              bottomElement={
                <View style={styles.details}>
                  <Text style={[styles.status, { color: statusColor(status) }]}>
                    {statusLabel(status)}
                    <Text style={{ color: colors.textSecondary }}>
                      {' · '}
                      {required ? t('permissions.required') : t('permissions.optional')}
                    </Text>
                  </Text>
                  <Text style={[styles.description, { color: colors.textSecondary }]}>
                    {t(`permissionsScreen.${translationKey}.description`)}
                  </Text>
                </View>
              }
            />
          );
        })}
      </SettingsGroup>

      <SettingsGroup index={1}>
        <SettingsItem
          grouped
          isLast
          icon={<HeartIcon size={18} color="#FFFFFF" />}
          iconColor="#34C759"
          title={t('trackingHealth.title', { ns: 'profile' })}
          subtitle={t('trackingHealth.subtitle', { ns: 'profile' })}
          onPress={() => router.push('/settings/tracking-health')}
        />
      </SettingsGroup>
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 13, lineHeight: 18, paddingHorizontal: 32, marginBottom: 16 },
  details: { paddingLeft: 42, gap: 2 },
  status: { fontSize: 13, fontWeight: '600' },
  description: { fontSize: 13, lineHeight: 18 },
});
