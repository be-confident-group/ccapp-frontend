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
import * as Location from 'expo-location';
import {
  BellIcon,
  BoltIcon,
  MapIcon,
  MapPinIcon,
} from 'react-native-heroicons/outline';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/ui/Button';
import { FontSizes, FontWeights, Spacing } from '@/constants/theme';
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

function advanceStep(current: Step): Step {
  const idx = STEP_ORDER.indexOf(current);
  return STEP_ORDER[idx + 1] ?? 'done';
}

const ICON_SIZE = 80;

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

  // Track the previous AppState value so we can detect background→active transition
  const prevAppState = useRef<AppStateStatus>(AppState.currentState);

  // ── AppState re-check for Android bg-location ──────────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'android' || step !== 'bg-location') {
      return;
    }

    const subscription = AppState.addEventListener(
      'change',
      async (nextState: AppStateStatus) => {
        if (prevAppState.current === 'background' && nextState === 'active') {
          const { status } = await Location.getBackgroundPermissionsAsync();
          if (status === 'granted') {
            setStep(advanceStep('bg-location'));
          }
        }
        prevAppState.current = nextState;
      },
    );

    return () => {
      subscription.remove();
    };
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
    } finally {
      setLoading(false);
    }
    // Advance regardless of outcome (except bg-location on Android — user
    // returns from Settings, AppState listener handles it; but we don't block
    // the button either, so tapping again is safe)
    if (!(Platform.OS === 'android' && step === 'bg-location')) {
      setStep(advanceStep(step));
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
    showSkip: boolean;
  };

  function getStepConfig(s: Step): StepConfig {
    switch (s) {
      case 'fg-location':
        return {
          icon: <MapPinIcon size={ICON_SIZE} color={colors.primary} />,
          title: t('permissions.fgLocation.title'),
          body: t('permissions.fgLocation.body'),
          buttonLabel: t('permissions.fgLocation.allow'),
          showSkip: true,
        };
      case 'bg-location':
        return {
          icon: <MapIcon size={ICON_SIZE} color={colors.primary} />,
          title: t('permissions.bgLocation.title'),
          body: t('permissions.bgLocation.body'),
          // Android shows "Open Settings"; iOS shows system prompt via requestLocationBackground
          buttonLabel: t('permissions.bgLocation.openSettings'),
          showSkip: false,
        };
      case 'motion':
        return {
          icon: <BoltIcon size={ICON_SIZE} color={colors.primary} />,
          title: t('permissions.motion.title'),
          body: t('permissions.motion.body'),
          buttonLabel: t('permissions.motion.allow'),
          showSkip: true,
        };
      case 'notifications':
        return {
          icon: <BellIcon size={ICON_SIZE} color={colors.primary} />,
          title: t('permissions.notifications.title'),
          body: t('permissions.notifications.body'),
          buttonLabel: t('permissions.notifications.allow'),
          showSkip: true,
        };
      default:
        // 'done' — should never render
        return {
          icon: <BellIcon size={ICON_SIZE} color={colors.primary} />,
          title: '',
          body: '',
          buttonLabel: '',
          showSkip: false,
        };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  if (step === 'done') {
    // Navigation is triggered in useEffect; render nothing while transitioning
    return null;
  }

  const config = getStepConfig(step);

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={['top', 'bottom']}
    >
      {/* Icon + text content — centered in the upper portion */}
      <View style={styles.content}>
        <View style={styles.iconWrapper}>{config.icon}</View>

        <Text style={[styles.title, { color: colors.text }]}>
          {config.title}
        </Text>

        <Text style={[styles.body, { color: colors.textSecondary }]}>
          {config.body}
        </Text>
      </View>

      {/* Buttons — anchored toward the bottom */}
      <View style={styles.actions}>
        <Button
          title={config.buttonLabel}
          onPress={handleAllow}
          variant="primary"
          size="large"
          fullWidth
          loading={loading}
        />

        {config.showSkip && (
          <TouchableOpacity
            onPress={handleSkip}
            activeOpacity={0.7}
            style={styles.skipButton}
          >
            <Text style={[styles.skipText, { color: colors.primary }]}>
              {t(`permissions.${stepKeyForTranslation(step)}.skip`)}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

// Helper: map Step to camelCase translation key segment
function stepKeyForTranslation(step: Step): string {
  switch (step) {
    case 'fg-location':
      return 'fgLocation';
    case 'bg-location':
      return 'bgLocation';
    case 'motion':
      return 'motion';
    case 'notifications':
      return 'notifications';
    default:
      return '';
  }
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
  iconWrapper: {
    marginBottom: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontWeight: FontWeights.semibold,
  },
});
