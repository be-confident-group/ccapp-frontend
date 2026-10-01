// components/onboarding/PermissionToast.tsx
import React, { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
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
import { TAB_BAR_HEIGHT, useTabBarBottomOffset } from '@/contexts/TabBarContext';
import { ThemedText } from '@/components/themed-text';
import { FontSizes, FontWeights, Spacing } from '@/constants/theme';
import {
  usePermissionToasts,
  type PermissionToastKey,
} from '@/lib/hooks/usePermissionToasts';

const TOAST_RADIUS = 28;
const SHOW_SPRING = { damping: 18, stiffness: 220, mass: 0.8 };

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
  const tabBarBottom = useTabBarBottomOffset();
  const { current, isRequesting, handleAllow, handleOpenSettings, handleDismiss } =
    usePermissionToasts();

  // Keep a local copy so the card content stays visible during the exit animation
  const [displayed, setDisplayed] = useState(current);
  // 0 = hidden below, 1 = shown. Only transforms animate: opacity would break the glass.
  const progress = useSharedValue(0);

  useEffect(() => {
    if (current) {
      setDisplayed(current);
      progress.value = withSpring(1, SHOW_SPRING);
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
      { translateY: (1 - progress.value) * 140 },
      { scale: 0.9 + 0.1 * progress.value },
    ],
  }));

  if (!displayed) return null;

  const Icon = ICONS[displayed.key];
  const toastKey = displayed.key;
  const bottomOffset = tabBarBottom + TAB_BAR_HEIGHT + 12;

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
      {/* Icon box */}
      <View
        style={[
          styles.iconBox,
          { backgroundColor: colors.glassHighlight },
        ]}
      >
        <Icon size={18} color={colors.glassTint} />
      </View>

      {/* Text */}
      <View style={styles.textContainer}>
        <ThemedText style={styles.title}>
          {t(`permissionToast.${toastKey}.title`)}
        </ThemedText>
        <ThemedText style={[styles.subtitle, { color: colors.textMuted }]}>
          {t(`permissionToast.${toastKey}.subtitle`)}
        </ThemedText>
      </View>

      {/* Action button */}
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
      />

      {/* Dismiss */}
      <TouchableOpacity
        onPress={handleDismiss}
        accessibilityRole="button"
        accessibilityLabel={t('permissionToast.dismiss')}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={styles.dismiss}
      >
        <XMarkIcon size={16} color={colors.glassInactive} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    paddingLeft: Spacing.md,
    borderRadius: TOAST_RADIUS,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 100,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
  },
  subtitle: {
    fontSize: FontSizes.xs,
    lineHeight: 16,
  },
  dismiss: {
    padding: 4,
  },
});
