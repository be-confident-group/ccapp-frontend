import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BellIcon, BoltIcon, MapIcon, MapPinIcon } from 'react-native-heroicons/outline';
import { CheckCircleIcon } from 'react-native-heroicons/solid';
import { useTheme } from '@/contexts/ThemeContext';
import Button from '@/components/ui/Button';
import { Touchable } from '@/components/ui/Touchable';
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

type PermKey = 'locationForeground' | 'locationBackground' | 'motion' | 'notifications';
type Statuses = Record<string, PermissionResult['status']>;

interface PermRow {
  key: PermKey;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  /** Key under `permissionsScreen` holding this permission's name and description. */
  copy: 'locationFg' | 'locationBg' | 'motion' | 'notifications';
  required: boolean;
  request: () => Promise<PermissionResult>;
}

const ROWS: PermRow[] = [
  { key: 'locationForeground', icon: MapPinIcon, copy: 'locationFg', required: true, request: requestLocationForeground },
  { key: 'locationBackground', icon: MapIcon, copy: 'locationBg', required: true, request: requestLocationBackground },
  { key: 'motion', icon: BoltIcon, copy: 'motion', required: true, request: requestMotion },
  { key: 'notifications', icon: BellIcon, copy: 'notifications', required: false, request: requestNotifications },
];

// Background location is asked last: the system only offers it once foreground
// access exists, and on Android it takes the user out to Settings.
const REQUEST_ORDER: PermKey[] = ['locationForeground', 'motion', 'notifications', 'locationBackground'];

// App Store guideline 5.1.1(iv): on iOS the pre-permission screen must lead
// straight to the system prompts — neutral "Continue" wording, no way to defer.
const IS_IOS = Platform.OS === 'ios';

function requiredGranted(statuses: Statuses) {
  return ROWS.every((row) => !row.required || statuses[row.key] === 'granted');
}

/**
 * One screen for every permission the app needs. The system still shows its
 * own prompt per permission (apps cannot grant several at once), but a single
 * tap here runs them back to back instead of a page and a button for each.
 */
export default function PermissionsWizardScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation('onboarding');
  const router = useRouter();

  const [statuses, setStatuses] = useState<Statuses | null>(null);
  const [running, setRunning] = useState(false);
  // True once the prompts have been through a full pass.
  const [attempted, setAttempted] = useState(false);
  const prevAppState = useRef<AppStateStatus>(AppState.currentState);

  const finish = useCallback(() => {
    router.push('/(onboarding)/all-set');
  }, [router]);

  // Nothing to ask (returning user, reinstall with permissions kept): move on.
  useEffect(() => {
    let cancelled = false;
    checkAll().then((current) => {
      if (cancelled) return;
      if (ROWS.every((row) => current[row.key] === 'granted')) finish();
      else setStatuses(current);
    });
    return () => {
      cancelled = true;
    };
  }, [finish]);

  // Coming back from system Settings: refresh, and move on once nothing required is missing.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (next: AppStateStatus) => {
      const returning = prevAppState.current !== 'active' && next === 'active';
      prevAppState.current = next;
      if (!returning || running) return;
      const current = await checkAll();
      setStatuses(current);
      if (attempted && requiredGranted(current)) finish();
    });
    return () => subscription.remove();
  }, [attempted, running, finish]);

  async function handleAllowAll() {
    setRunning(true);
    try {
      let current = await checkAll();
      for (const key of REQUEST_ORDER) {
        if (current[key] === 'granted') continue;
        if (key === 'locationBackground' && current.locationForeground !== 'granted') continue;
        await ROWS.find((row) => row.key === key)!.request();
        current = await checkAll();
        setStatuses(current);
      }

      if (IS_IOS || requiredGranted(current)) {
        finish();
      } else if (attempted) {
        // The system stops showing prompts after repeated denials; Settings is the only way left.
        openAppSettings();
      }
      setAttempted(true);
    } finally {
      setRunning(false);
    }
  }

  if (!statuses) return null;

  // Android grants background location only from Settings; say so on the button once that's all that's left.
  const onlySettingsLeft =
    !IS_IOS &&
    ROWS.every((row) => !row.required || row.key === 'locationBackground' || statuses[row.key] === 'granted');
  const buttonLabel = IS_IOS
    ? t('permissions.continue')
    : onlySettingsLeft || attempted
      ? t('permissions.bgLocation.openSettings')
      : t('permissions.allowAll');

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: colors.text }]}>{t('permissions.bgLocation.title')}</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>{t('permissionsScreen.subtitle')}</Text>

        <View style={[styles.list, { backgroundColor: colors.card }]}>
          {ROWS.map((row, index) => {
            const granted = statuses[row.key] === 'granted';
            const Icon = row.icon;
            return (
              <View
                key={row.key}
                style={[styles.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
              >
                <View style={[styles.iconTile, { backgroundColor: colors.glassHighlight }]}>
                  <Icon size={22} color={colors.glassTint} />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowName, { color: colors.text }]}>
                    {t(`permissionsScreen.${row.copy}.name`)}
                  </Text>
                  <Text style={[styles.rowDescription, { color: colors.textSecondary }]}>
                    {t(`permissionsScreen.${row.copy}.description`)}
                  </Text>
                  <Text style={[styles.rowStatus, { color: colors.textMuted }]}>
                    {granted
                      ? t('permissionsScreen.granted')
                      : row.required
                        ? t('permissions.required')
                        : t('permissions.optional')}
                  </Text>
                </View>
                {granted && (
                  <CheckCircleIcon size={24} color={colors.success} accessibilityLabel={t('permissionsScreen.granted')} />
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <Button
          title={buttonLabel}
          onPress={handleAllowAll}
          variant="primary"
          size="large"
          fullWidth
          loading={running}
        />
        {!IS_IOS && (
          <Touchable onPress={finish} activeOpacity={0.7} accessibilityRole="button" style={styles.skipButton}>
            <Text style={[styles.skipText, { color: colors.textSecondary }]}>{t('permissions.notNow')}</Text>
          </Touchable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSizes.xxl,
    lineHeight: 40,
    fontWeight: FontWeights.bold,
    marginBottom: Spacing.sm,
  },
  body: {
    fontSize: FontSizes.md,
    lineHeight: 24,
    marginBottom: Spacing.lg,
  },
  list: {
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: Spacing.md,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    fontSize: FontSizes.md,
    lineHeight: 22,
    fontWeight: FontWeights.semibold,
  },
  rowDescription: {
    fontSize: FontSizes.sm,
    lineHeight: 20,
  },
  rowStatus: {
    fontSize: FontSizes.xs,
    lineHeight: 16,
    fontWeight: FontWeights.semibold,
    marginTop: 2,
  },
  actions: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: BorderRadius.full,
  },
  skipText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
  },
});
