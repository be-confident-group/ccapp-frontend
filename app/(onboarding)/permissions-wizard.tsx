import React, { useEffect, useRef, useState } from 'react';
import {
  AppState,
  AppStateStatus,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  BellIcon,
  BoltIcon,
  MapIcon,
  MapPinIcon,
} from 'react-native-heroicons/outline';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/ui/Button';
import { BorderRadius, FontSizes, FontWeights, Spacing } from '@/constants/theme';
import {
  openAppSettings,
  requestLocationBackground,
  requestLocationForeground,
  requestMotion,
  requestNotifications,
} from '@/lib/permissions/wizard';
import { markPermissionSkipped } from '@/lib/onboarding/state';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Step = 'fg-location' | 'bg-location' | 'motion' | 'notifications' | 'done';

const STEP_ORDER: Step[] = [
  'fg-location',
  'bg-location',
  'motion',
  'notifications',
  'done',
];

const CONTENT_STEPS: Step[] = ['fg-location', 'bg-location', 'motion', 'notifications'];

function advanceStep(current: Step): Step {
  const idx = STEP_ORDER.indexOf(current);
  return STEP_ORDER[idx + 1] ?? 'done';
}

const ICON_SIZE = 64;

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function StepDots({ currentStep, colors }: { currentStep: Step; colors: ReturnType<typeof useTheme>['colors'] }) {
  return (
    <View style={dotStyles.row}>
      {CONTENT_STEPS.map((s) => (
        <View
          key={s}
          style={[
            dotStyles.dot,
            {
              backgroundColor: s === currentStep ? colors.primary : 'transparent',
              borderColor: s === currentStep ? colors.primary : colors.border,
            },
          ]}
        />
      ))}
    </View>
  );
}

const dotStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
  },
});

function PermissionChip({
  required,
  colors,
  t,
}: {
  required: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
  t: (key: string) => string;
}) {
  return (
    <View
      style={[
        chipStyles.chip,
        {
          backgroundColor: required
            ? colors.primary + '20'
            : colors.textMuted + '20',
        },
      ]}
    >
      <Text
        style={[
          chipStyles.label,
          { color: required ? colors.primary : colors.textMuted },
        ]}
      >
        {required ? t('permissions.required') : t('permissions.optional')}
      </Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    alignSelf: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.sm,
  },
  label: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function PermissionsWizardScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation('onboarding');
  const router = useRouter();
  const { currentUserId } = useAuth();

  const [step, setStep] = useState<Step>('fg-location');
  const [loading, setLoading] = useState(false);

  const prevAppState = useRef<AppStateStatus>(AppState.currentState);

  // ── AppState re-check for Android bg-location ──────────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'android' || step !== 'bg-location') {
      return;
    }

    prevAppState.current = AppState.currentState;
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (prevAppState.current === 'background' && nextState === 'active') {
          setStep(advanceStep('bg-location'));
        }
        prevAppState.current = nextState;
      },
    );

    return () => subscription.remove();
  }, [step]);

  // ── Navigate when done ─────────────────────────────────────────────────────
  useEffect(() => {
    if (step === 'done') {
      router.push('/(onboarding)/all-set');
    }
  }, [step, router]);

  // ─────────────────────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────────────────────

  async function handleAllow() {
    setLoading(true);
    try {
      switch (step) {
        case 'fg-location':
          await requestLocationForeground();
          break;
        case 'bg-location':
          if (Platform.OS === 'android') {
            openAppSettings();
          } else {
            await requestLocationBackground();
          }
          break;
        case 'motion':
          await requestMotion();
          break;
        case 'notifications':
          await requestNotifications();
          break;
        default:
          break;
      }
      if (!(Platform.OS === 'android' && step === 'bg-location')) {
        setStep(advanceStep(step));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSkip() {
    if (currentUserId !== null) {
      await markPermissionSkipped(currentUserId, step);
    }
    setStep(advanceStep(step));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step config
  // ─────────────────────────────────────────────────────────────────────────

  type StepConfig = {
    icon: React.ReactElement;
    title: string;
    body: string;
    buttonLabel: string;
    required: boolean;
    skipLabel: string;
  };

  function getStepConfig(s: Step): StepConfig {
    switch (s) {
      case 'fg-location':
        return {
          icon: <MapPinIcon size={ICON_SIZE} color={colors.primary} />,
          title: t('permissions.fgLocation.title'),
          body: t('permissions.fgLocation.body'),
          buttonLabel: t('permissions.fgLocation.allow'),
          required: true,
          skipLabel: t('permissions.fgLocation.skip'),
        };
      case 'bg-location':
        return {
          icon: <MapIcon size={ICON_SIZE} color={colors.primary} />,
          title: t('permissions.bgLocation.title'),
          body: t('permissions.bgLocation.body'),
          buttonLabel:
            Platform.OS === 'android'
              ? t('permissions.bgLocation.openSettings')
              : t('permissions.bgLocation.allow'),
          required: true,
          skipLabel: t('permissions.bgLocation.notNow'),
        };
      case 'motion':
        return {
          icon: <BoltIcon size={ICON_SIZE} color={colors.primary} />,
          title: t('permissions.motion.title'),
          body: t('permissions.motion.body'),
          buttonLabel: t('permissions.motion.allow'),
          required: true,
          skipLabel: t('permissions.motion.skip'),
        };
      case 'notifications':
        return {
          icon: <BellIcon size={ICON_SIZE} color={colors.primary} />,
          title: t('permissions.notifications.title'),
          body: t('permissions.notifications.body'),
          buttonLabel: t('permissions.notifications.allow'),
          required: false,
          skipLabel: t('permissions.notifications.skip'),
        };
      default:
        return {
          icon: <BellIcon size={ICON_SIZE} color={colors.primary} />,
          title: '',
          body: '',
          buttonLabel: '',
          required: false,
          skipLabel: '',
        };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  if (step === 'done') return null;

  const config = getStepConfig(step);

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={['top', 'bottom']}
    >
      {/* Step indicator */}
      <StepDots currentStep={step} colors={colors} />

      {/* Icon + text */}
      <View style={styles.content}>
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: colors.primary + '1F' },
          ]}
        >
          {config.icon}
        </View>

        <PermissionChip required={config.required} colors={colors} t={t} />

        <Text style={[styles.title, { color: colors.text }]}>
          {config.title}
        </Text>

        <Text style={[styles.body, { color: colors.textSecondary }]}>
          {config.body}
        </Text>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          title={config.buttonLabel}
          onPress={handleAllow}
          variant="primary"
          size="large"
          fullWidth
          loading={loading}
        />

        <TouchableOpacity
          onPress={handleSkip}
          activeOpacity={0.7}
          style={styles.skipButton}
        >
          <Text style={[styles.skipText, { color: colors.textMuted }]}>
            {config.skipLabel}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.bold,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  body: {
    fontSize: FontSizes.md,
    textAlign: 'center',
    lineHeight: 24,
  },
  actions: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  skipText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
  },
});
