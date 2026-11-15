// components/onboarding/PermissionToast.tsx
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import {
  BellIcon,
  BoltIcon,
  MapIcon,
  MapPinIcon,
  XMarkIcon,
} from 'react-native-heroicons/outline';
import { useTheme } from '@/contexts/ThemeContext';
import Button from '@/components/ui/Button';
import { GlassSurface } from '@/components/ui/GlassSurface';
import { useTabBarInset } from '@/contexts/TabBarContext';
import { ThemedText } from '@/components/themed-text';
import { Springs } from '@/constants/motion';
import { FontSizes, FontWeights, Spacing } from '@/constants/theme';
import {
  usePermissionToasts,
  type PermissionToastKey,
} from '@/lib/hooks/usePermissionToasts';
import { Touchable } from '@/components/ui/Touchable';

const TOAST_RADIUS = 28;

type IconComponent = React.ComponentType<{ size: number; color: string }>;

const ICONS: Record<PermissionToastKey, IconComponent> = {
  locationForeground: MapPinIcon,
  locationBackground: MapIcon,
  motion: BoltIcon,
  notifications: BellIcon,
};

export function PermissionToast() {
  const { colors } = useTheme();
  const { t } = useTranslation('onboarding');
  const tabBarInset = useTabBarInset();
  const { current, isRequesting, handleAllow, handleOpenSettings, handleDismiss } =
    usePermissionToasts();

  // Keep a local copy so the card content stays visible during the exit animation
  const [displayed, setDisplayed] = useState(current);
  // 0 = hidden below, 1 = shown. Only transforms animate: opacity would break the glass.
  const progress = useSharedValue(0);

  useEffect(() => {
    if (current) {
      setDisplayed(current);
      progress.value = withSpring(1, Springs.spatial);
    } else {
      progress.value = withTiming(
        0,
        { duration: 200, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(setDisplayed)(null);
        }
      );
    }
  }, [current, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: (1 - progress.value) * 220 },
      { scale: 0.9 + 0.1 * progress.value },
    ],
  }));

  if (!displayed) return null;

  const Icon = ICONS[displayed.key];
  const toastKey = displayed.key;
  // 12 above the tab bar, and above the FAB on Android so it stays tappable.
  const bottomOffset = tabBarInset - 4;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          shadowColor: colors.shadow,
          bottom: bottomOffset,
        },
        animatedStyle,
      ]}
    >
      <GlassSurface borderRadius={TOAST_RADIUS} />

      <View style={styles.header}>
        <View style={[styles.iconBox, { backgroundColor: colors.glassHighlight }]}>
          <Icon size={20} color={colors.glassTint} />
        </View>

        <View style={styles.textContainer}>
          <ThemedText style={styles.title}>{t(`permissionToast.${toastKey}.title`)}</ThemedText>
          <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
            {t(`permissionToast.${toastKey}.subtitle`)}
          </ThemedText>
        </View>

        <Touchable
          onPress={handleDismiss}
          accessibilityRole="button"
          accessibilityLabel={t('permissionToast.dismiss')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.dismiss}
        >
          <XMarkIcon size={20} color={colors.glassInactive} />
        </Touchable>
      </View>

      <Button
        title={
          displayed.needsSettings
            ? t('permissionToast.openSettings')
            : t('permissionToast.allow')
        }
        onPress={displayed.needsSettings ? handleOpenSettings : handleAllow}
        variant="primary"
        size="small"
        loading={isRequesting}
        style={styles.action}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Stacked so the message gets the full width; a side-by-side button used to
  // squeeze the title onto two lines.
  container: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: TOAST_RADIUS,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: FontSizes.md,
    lineHeight: 22,
    fontWeight: FontWeights.semibold,
  },
  subtitle: {
    fontSize: FontSizes.sm,
    lineHeight: 20,
  },
  dismiss: {
    padding: 6,
    borderRadius: 16,
  },
  action: {
    alignSelf: 'flex-end',
  },
});
