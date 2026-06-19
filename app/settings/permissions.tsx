import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  AppStateStatus,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  BellIcon,
  BoltIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  ExclamationCircleIcon,
  HeartIcon,
  MapIcon,
  MapPinIcon,
  QuestionMarkCircleIcon,
} from 'react-native-heroicons/outline';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useTheme } from '@/contexts/ThemeContext';
import { BorderRadius, FontSizes, FontWeights, Spacing } from '@/constants/theme';
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

  function StatusIcon({ status }: { status: PermissionResult['status'] }) {
    const size = 20;
    if (status === 'granted') return <CheckCircleIcon size={size} color={colors.success} />;
    if (status === 'denied') return <ExclamationCircleIcon size={size} color={colors.error} />;
    return <QuestionMarkCircleIcon size={size} color={colors.textMuted} />;
  }

  function needsSettings(key: PermissionKey, status: PermissionResult['status']): boolean {
    if (key === 'locationBackground' && Platform.OS === 'android') return true;
    return status === 'denied';
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['top', 'bottom']}
    >
      <Header title={t('permissionsScreen.title')} showBack />
      <ThemedView style={styles.container}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <View style={styles.content}>
            <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
              {t('permissionsScreen.subtitle')}
            </ThemedText>

            {rows.map(({ key, translationKey }) => {
              const status = statuses[key];
              const isGranted = status === 'granted';
              const isRequesting = requesting === key;
              const required = PERMISSION_REQUIRED[key];
              const PermIcon = PERMISSION_ICONS[key];
              const opensSettings = needsSettings(key, status);

              return (
                <Card key={key} variant="outlined" style={styles.card}>
                  <View style={styles.row}>
                    {/* Permission icon box */}
                    <View
                      style={[
                        styles.iconBox,
                        { backgroundColor: colors.primary + '1F' },
                      ]}
                    >
                      <PermIcon size={20} color={colors.primary} />
                    </View>

                    {/* Text */}
                    <View style={styles.rowText}>
                      <View style={styles.nameRow}>
                        <ThemedText style={styles.rowLabel}>
                          {t(`permissionsScreen.${translationKey}.name`)}
                        </ThemedText>
                        {/* Required / Optional chip */}
                        <View
                          style={[
                            styles.chip,
                            {
                              backgroundColor: required
                                ? colors.primary + '20'
                                : colors.textMuted + '20',
                            },
                          ]}
                        >
                          <ThemedText
                            style={[
                              styles.chipText,
                              { color: required ? colors.primary : colors.textMuted },
                            ]}
                          >
                            {required
                              ? t('permissions.required')
                              : t('permissions.optional')}
                          </ThemedText>
                        </View>
                      </View>
                      <ThemedText style={[styles.rowDescription, { color: colors.textMuted }]}>
                        {t(`permissionsScreen.${translationKey}.description`)}
                      </ThemedText>
                      <View style={styles.statusRow}>
                        <StatusIcon status={status} />
                        <ThemedText
                          style={[styles.statusText, { color: statusColor(status) }]}
                        >
                          {statusLabel(status)}
                        </ThemedText>
                      </View>
                    </View>

                    {/* Action button — only when not yet granted */}
                    {!isGranted && (
                      <Button
                        title={
                          opensSettings
                            ? t('permissionsScreen.openSettings')
                            : t('permissionsScreen.request')
                        }
                        onPress={() =>
                          opensSettings ? openAppSettings() : handleRequest(key)
                        }
                        variant="outline"
                        size="small"
                        loading={isRequesting}
                        style={styles.actionButton}
                      />
                    )}
                  </View>
                </Card>
              );
            })}

            {/* Tracking Health link */}
            <TouchableOpacity
              onPress={() => router.push('/settings/tracking-health')}
              style={[styles.healthLink, { borderColor: colors.border }]}
            >
              <View style={[styles.healthIconBox, { backgroundColor: colors.primary + '1F' }]}>
                <HeartIcon size={18} color={colors.primary} />
              </View>
              <View style={styles.healthLinkText}>
                <ThemedText style={styles.healthLinkTitle}>
                  {t('trackingHealth.title', { ns: 'profile' })}
                </ThemedText>
                <ThemedText style={[styles.healthLinkSubtitle, { color: colors.textMuted }]}>
                  {t('trackingHealth.subtitle', { ns: 'profile' })}
                </ThemedText>
              </View>
              <ChevronRightIcon size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSizes.sm,
    lineHeight: 20,
    marginBottom: Spacing.xs,
  },
  card: {
    marginVertical: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  rowText: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  rowLabel: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
  },
  chip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  chipText: {
    fontSize: 10,
    fontWeight: FontWeights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  rowDescription: {
    fontSize: FontSizes.xs,
    lineHeight: 17,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  statusText: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.medium,
  },
  actionButton: {
    alignSelf: 'center',
    flexShrink: 0,
  },
  healthLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.xs,
  },
  healthIconBox: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  healthLinkText: { flex: 1 },
  healthLinkTitle: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold },
  healthLinkSubtitle: { fontSize: FontSizes.xs, lineHeight: 17, marginTop: 2 },
});
