import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, AppStateStatus, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  QuestionMarkCircleIcon,
} from 'react-native-heroicons/solid';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import Header from '@/components/layout/Header';
import { useTheme } from '@/contexts/ThemeContext';
import { FontSizes, FontWeights, Spacing } from '@/constants/theme';
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
        case 'locationForeground':
          await requestLocationForeground();
          break;
        case 'locationBackground':
          await requestLocationBackground();
          // Android opens Settings — AppState listener will re-check on return
          break;
        case 'motion':
          await requestMotion();
          break;
        case 'notifications':
          await requestNotifications();
          break;
      }
      await refresh();
    } finally {
      setRequesting(null);
    }
  }

  const rows: { key: PermissionKey; needsSettings: boolean }[] = [
    { key: 'locationForeground', needsSettings: false },
    { key: 'locationBackground', needsSettings: true },
    { key: 'motion', needsSettings: false },
    { key: 'notifications', needsSettings: false },
  ];

  function StatusIcon({ status }: { status: PermissionResult['status'] }) {
    if (status === 'granted') {
      return <CheckCircleIcon size={22} color={colors.success ?? '#22c55e'} />;
    }
    if (status === 'denied') {
      return <ExclamationCircleIcon size={22} color={colors.error} />;
    }
    return <QuestionMarkCircleIcon size={22} color={colors.textMuted} />;
  }

  function statusLabel(status: PermissionResult['status']): string {
    if (status === 'granted') return t('permissionsScreen.granted');
    if (status === 'denied') return t('permissionsScreen.denied');
    return t('permissionsScreen.notDetermined');
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
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

            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {rows.map((row, index) => {
                const status = statuses[row.key];
                const isGranted = status === 'granted';
                const isRequesting = requesting === row.key;
                const translationKey = row.key === 'locationForeground'
                  ? 'locationFg'
                  : row.key === 'locationBackground'
                  ? 'locationBg'
                  : row.key === 'motion'
                  ? 'motion'
                  : 'notifications';

                return (
                  <View key={row.key}>
                    {index > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                    <View style={styles.row}>
                      <StatusIcon status={status} />
                      <View style={styles.rowText}>
                        <ThemedText style={styles.rowLabel}>
                          {t(`permissionsScreen.${translationKey}.name`)}
                        </ThemedText>
                        <ThemedText style={[styles.rowDescription, { color: colors.textMuted }]}>
                          {t(`permissionsScreen.${translationKey}.description`)}
                        </ThemedText>
                        <ThemedText style={[styles.statusText, {
                          color: isGranted ? (colors.success ?? '#22c55e') : status === 'denied' ? colors.error : colors.textMuted,
                        }]}>
                          {statusLabel(status)}
                        </ThemedText>
                      </View>
                      {!isGranted && (
                        <TouchableOpacity
                          style={[styles.button, { backgroundColor: colors.primary }]}
                          onPress={() => row.needsSettings || status === 'denied'
                            ? openAppSettings()
                            : handleRequest(row.key)
                          }
                          disabled={isRequesting}
                        >
                          {isRequesting ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <ThemedText style={styles.buttonText}>
                              {row.needsSettings || status === 'denied'
                                ? t('permissionsScreen.openSettings')
                                : t('permissionsScreen.request')
                              }
                            </ThemedText>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
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
  content: { padding: Spacing.lg, gap: Spacing.md },
  subtitle: { fontSize: FontSizes.sm, lineHeight: 20 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold },
  rowDescription: { fontSize: FontSizes.xs, lineHeight: 18 },
  statusText: { fontSize: FontSizes.xs, fontWeight: FontWeights.medium, marginTop: 2 },
  button: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.semibold,
  },
  divider: { height: 1, marginHorizontal: Spacing.md },
});
