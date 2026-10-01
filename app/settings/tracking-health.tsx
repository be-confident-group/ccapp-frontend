import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  BoltIcon,
  CheckCircleIcon,
  CpuChipIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
  ShieldCheckIcon,
} from 'react-native-heroicons/solid';
import { ArrowPathIcon } from 'react-native-heroicons/outline';
import { SettingsGroup } from '@/components/profile/SettingsGroup';
import { SettingsItem } from '@/components/profile/SettingsItem';
import { SettingsScreen } from '@/components/settings/SettingsScreen';
import Button from '@/components/ui/Button';
import { useTheme } from '@/contexts/ThemeContext';
import { RadziTrackerNative, type TrackingHealth } from '@/lib/native/RadziTracker';

type CheckStatus = 'ok' | 'warn' | 'error' | 'info';

interface HealthCheck {
  id: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  labelKey: string;
  statusText: string;
  status: CheckStatus;
  onFix?: () => void;
  fixLabelKey?: string;
}

function buildChecks(health: TrackingHealth, t: (k: string) => string): HealthCheck[] {
  const checks: HealthCheck[] = [];
  const tk = (k: string) => t(`profile:trackingHealth.checks.${k}`);

  // Location permission
  const locStatus = health.locationAuth === 'always' ? 'ok'
    : health.locationAuth === 'whenInUse' ? 'warn' : 'error';
  checks.push({
    id: 'locationAuth',
    icon: MapPinIcon,
    labelKey: 'profile:trackingHealth.checks.locationAuth',
    statusText: health.locationAuth === 'always' ? tk('locationAuthAlways')
      : health.locationAuth === 'whenInUse' ? tk('locationAuthWhenInUse')
      : tk('locationAuthDenied'),
    status: locStatus,
    onFix: () => Linking.openSettings(),
    fixLabelKey: 'profile:trackingHealth.fixIt',
  });

  // Precise location (iOS)
  if (Platform.OS === 'ios') {
    checks.push({
      id: 'locationPrecise',
      icon: MapPinIcon,
      labelKey: 'profile:trackingHealth.checks.locationPrecise',
      statusText: health.locationPrecise ? tk('locationPreciseOk') : tk('locationPreciseDegraded'),
      status: health.locationPrecise ? 'ok' : 'warn',
      onFix: !health.locationPrecise ? () => Linking.openSettings() : undefined,
      fixLabelKey: 'profile:trackingHealth.fixIt',
    });
  }

  // Motion
  const motionOk = health.motion === 'granted';
  checks.push({
    id: 'motion',
    icon: BoltIcon,
    labelKey: 'profile:trackingHealth.checks.motion',
    statusText: motionOk ? tk('motionGranted') : tk('motionDenied'),
    status: motionOk ? 'ok' : 'error',
    onFix: !motionOk ? () => Linking.openSettings() : undefined,
    fixLabelKey: 'profile:trackingHealth.fixIt',
  });

  // iOS: Low Power Mode
  if (Platform.OS === 'ios') {
    checks.push({
      id: 'lowPowerMode',
      icon: ShieldCheckIcon,
      labelKey: 'profile:trackingHealth.checks.lowPowerMode',
      statusText: health.lowPowerMode ? tk('lowPowerModeOn') : tk('lowPowerModeOff'),
      status: health.lowPowerMode ? 'warn' : 'ok',
    });
  }

  // Android: battery optimisation
  if (Platform.OS === 'android') {
    checks.push({
      id: 'batteryOpt',
      icon: ShieldCheckIcon,
      labelKey: 'profile:trackingHealth.checks.batteryOpt',
      statusText: health.batteryOptExempt ? tk('batteryOptExempt') : tk('batteryOptActive'),
      status: health.batteryOptExempt ? 'ok' : 'warn',
      onFix: !health.batteryOptExempt
        ? () => Linking.openSettings()
        : undefined,
      fixLabelKey: 'profile:trackingHealth.fixIt',
    });
  }

  // Engine state
  const engineIdle = health.engineState === 'idle';
  checks.push({
    id: 'engine',
    icon: CpuChipIcon,
    labelKey: 'profile:trackingHealth.checks.engineState',
    statusText: engineIdle
      ? tk('engineIdle')
      : `${tk('engineActive')} (${health.engineState}${health.tripId ? ` · ${health.tripId.slice(-8)}` : ''})`,
    status: 'info',
  });

  return checks;
}

export default function TrackingHealthScreen() {
  const { t } = useTranslation('profile');
  const { colors } = useTheme();
  const [health, setHealth] = useState<TrackingHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const prevState = useRef<AppStateStatus>(AppState.currentState);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const h = await RadziTrackerNative.getTrackingHealth();
      setHealth(h);
    } catch {
      // Native module unavailable (web / simulator without rebuild)
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (prevState.current !== 'active' && next === 'active') refresh();
      prevState.current = next;
    });
    return () => sub.remove();
  }, [refresh]);

  const checks = health ? buildChecks(health, t) : [];
  const hasIssues = checks.some(c => c.status === 'error' || c.status === 'warn');

  const statusTint = (status: CheckStatus): string =>
    status === 'ok' ? colors.success
      : status === 'warn' ? colors.warning
      : status === 'error' ? colors.error
      : '#8E8E93';

  const summaryColor = hasIssues ? colors.warning : colors.success;

  return (
    <SettingsScreen
      title={t('trackingHealth.title')}
      loading={loading}
      loadingLabel={t('trackingHealth.loading')}
    >
      <SettingsGroup>
        <View style={styles.summary}>
          <View style={[styles.summaryIcon, { backgroundColor: summaryColor + '26' }]}>
            {hasIssues
              ? <ExclamationTriangleIcon size={40} color={summaryColor} />
              : <CheckCircleIcon size={40} color={summaryColor} />}
          </View>
          <Text style={[styles.summaryTitle, { color: colors.text }]}>
            {hasIssues ? t('trackingHealth.issuesFound') : t('trackingHealth.allGood')}
          </Text>
          <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
            {hasIssues
              ? t('trackingHealth.summaryIssues', {
                  defaultValue: 'Some settings may stop rides from being recorded in the background. Fix the items below.',
                })
              : t('trackingHealth.summaryOk', {
                  defaultValue: 'Background tracking is ready to run reliably on this device.',
                })}
          </Text>
        </View>
      </SettingsGroup>

      <SettingsGroup
        index={1}
        title={t('trackingHealth.checksHeader', { defaultValue: 'Checks' })}
      >
        {checks.map((check, index) => {
          const Icon = check.icon;
          const tint = statusTint(check.status);
          return (
            <SettingsItem
              key={check.id}
              grouped
              icon={<Icon size={18} color="#FFFFFF" />}
              iconColor={tint}
              title={t(check.labelKey.replace('profile:', ''))}
              isLast={index === checks.length - 1}
              bottomElement={
                <View style={styles.checkDetails}>
                  <Text
                    style={[
                      styles.checkStatus,
                      { color: check.status === 'ok' || check.status === 'info' ? colors.textSecondary : tint },
                    ]}
                  >
                    {check.statusText}
                  </Text>
                  {check.onFix && check.status !== 'ok' ? (
                    <Button
                      title={t('trackingHealth.fixIt')}
                      onPress={check.onFix}
                      variant="glass"
                      size="small"
                      style={styles.fixButton}
                    />
                  ) : null}
                </View>
              }
            />
          );
        })}
      </SettingsGroup>

      <View style={styles.refresh}>
        <Button
          title={t('trackingHealth.refresh')}
          onPress={refresh}
          variant="outline"
          fullWidth
          icon={<ArrowPathIcon size={16} color={colors.primary} />}
        />
      </View>
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  summary: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 20, gap: 8 },
  summaryIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  summaryTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  summaryText: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  checkDetails: { paddingLeft: 42, gap: 8, alignItems: 'flex-start' },
  checkStatus: { fontSize: 13, lineHeight: 18 },
  fixButton: { alignSelf: 'flex-start' },
  refresh: { paddingHorizontal: 16 },
});
