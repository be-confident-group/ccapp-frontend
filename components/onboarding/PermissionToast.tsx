// components/onboarding/PermissionToast.tsx
import React, { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { ThemedText } from '@/components/themed-text';
import { BorderRadius, FontSizes, FontWeights, Spacing } from '@/constants/theme';
import {
  usePermissionToasts,
  type PermissionToastKey,
} from '@/lib/hooks/usePermissionToasts';

const TAB_BAR_HEIGHT = 80;

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
  const insets = useSafeAreaInsets();
  const { current, isRequesting, handleAllow, handleOpenSettings, handleDismiss } =
    usePermissionToasts();

  // Keep a local copy so the card content stays visible during the exit animation
  const [displayed, setDisplayed] = useState(current);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    if (current) {
      setDisplayed(current);
      opacity.value = withTiming(1, { duration: 250 });
      translateY.value = withTiming(0, { duration: 250 });
    } else {
      opacity.value = withTiming(0, { duration: 200 }, (finished) => {
        if (finished) runOnJS(setDisplayed)(null);
      });
      translateY.value = withTiming(20, { duration: 200 });
    }
  }, [current, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!displayed) return null;

  const Icon = ICONS[displayed.key];
  const toastKey = displayed.key;
  const bottomOffset = TAB_BAR_HEIGHT + insets.bottom + 12;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          bottom: bottomOffset,
        },
        animatedStyle,
      ]}
    >
      {/* Icon box */}
      <View
        style={[
          styles.iconBox,
          { backgroundColor: colors.primary + '1F' },
        ]}
      >
        <Icon size={18} color={colors.primary} />
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
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={styles.dismiss}
      >
        <XMarkIcon size={16} color={colors.textMuted} />
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
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 100,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
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
