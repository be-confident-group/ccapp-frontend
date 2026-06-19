import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  AppStateStatus,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  ArrowPathIcon,
  BoltIcon,
  CheckCircleIcon,
  CpuChipIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
  ShieldCheckIcon,
  XCircleIcon,
} from 'react-native-heroicons/outline';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useTheme } from '@/contexts/ThemeContext';
import { BorderRadius, FontSizes, FontWeights, Spacing } from '@/constants/theme';
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

function StatusIcon({ status }: { status: CheckStatus }) {
  const { colors } = useTheme();
  const size = 18;
  if (status === 'ok') return <CheckCircleIcon size={size} color={colors.success} />;
  if (status === 'warn') return <ExclamationTriangleIcon size={size} color={colors.warning ?? '#F59E0B'} />;
  if (status === 'error') return <XCircleIcon size={size} color={colors.error} />;
  return <CheckCircleIcon size={size} color={colors.textMuted} />;
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

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <Header title={t('trackingHealth.title')} showBack />
      <ThemedView style={styles.container}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>
              {t('trackingHealth.loading')}
            </ThemedText>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* Summary banner */}
            <View style={[styles.banner, { backgroundColor: hasIssues ? colors.error + '15' : colors.success + '15' }]}>
              {hasIssues
                ? <ExclamationTriangleIcon size={20} color={colors.error} />
                : <CheckCircleIcon size={20} color={colors.success} />}
              <ThemedText style={[styles.bannerText, { color: hasIssues ? colors.error : colors.success }]}>
                {hasIssues ? t('trackingHealth.issuesFound') : t('trackingHealth.allGood')}
              </ThemedText>
            </View>

            {/* Individual checks */}
            {checks.map(check => {
              const Icon = check.icon;
              const statusColor = check.status === 'ok' ? colors.success
                : check.status === 'warn' ? (colors.warning ?? '#F59E0B')
                : check.status === 'error' ? colors.error
                : colors.textMuted;
              return (
                <Card key={check.id} variant="outlined" style={styles.card}>
                  <View style={styles.row}>
                    <View style={[styles.iconBox, { backgroundColor: colors.primary + '1F' }]}>
                      <Icon size={18} color={colors.primary} />
                    </View>
                    <View style={styles.rowText}>
                      <ThemedText style={styles.rowLabel}>
                        {t(check.labelKey.replace('profile:', ''))}
                      </ThemedText>
                      <View style={styles.statusRow}>
                        <StatusIcon status={check.status} />
                        <ThemedText style={[styles.statusText, { color: statusColor }]}>
                          {check.statusText}
                        </ThemedText>
                      </View>
                    </View>
                    {check.onFix && check.status !== 'ok' && (
                      <TouchableOpacity
                        onPress={check.onFix}
                        style={[styles.fixBtn, { borderColor: colors.primary + '60' }]}
                      >
                        <ThemedText style={[styles.fixText, { color: colors.primary }]}>
                          {t('trackingHealth.fixIt')}
                        </ThemedText>
                      </TouchableOpacity>
                    )}
                  </View>
                </Card>
              );
            })}

            <Button
              title={t('trackingHealth.refresh')}
              onPress={refresh}
              variant="outline"
              style={styles.refreshBtn}
              icon={<ArrowPathIcon size={16} color={colors.primary} />}
            />
          </ScrollView>
        )}
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  loadingText: { fontSize: FontSizes.sm },
  content: { padding: Spacing.lg, gap: Spacing.sm },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
  },
  bannerText: { fontSize: FontSizes.sm, fontWeight: FontWeights.semibold },
  card: { marginVertical: 0 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  rowText: { flex: 1, gap: 3 },
  rowLabel: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  statusText: { fontSize: FontSizes.xs, lineHeight: 17, flex: 1 },
  fixBtn: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    alignSelf: 'center',
    flexShrink: 0,
  },
  fixText: { fontSize: FontSizes.xs, fontWeight: FontWeights.semibold },
  refreshBtn: { marginTop: Spacing.md },
});
