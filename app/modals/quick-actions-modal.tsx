import { router, type Href } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  MegaphoneIcon,
  PencilSquareIcon,
  PlusIcon,
  StarIcon,
  UserGroupIcon,
} from 'react-native-heroicons/solid';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { GlassSurface } from '@/components/ui/GlassSurface';
import {
  TAB_BAR_ACTION_SIZE,
  TAB_BAR_MARGIN,
  useTabBarBottomOffset,
} from '@/contexts/TabBarContext';
import { useTheme } from '@/contexts/ThemeContext';

type ActionItem = {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  title: string;
  color: string;
  href: Href;
};

const OPEN_SPRING = { damping: 18, stiffness: 220, mass: 0.8 };
const CLOSE_DURATION = 180;
// Delay between items; the one nearest the button appears first.
const STAGGER = 35;
const MENU_GAP = 12;
const MENU_RADIUS = 28;

/**
 * Quick actions menu that grows out of the "+" bubble in the tab bar: the
 * bubble stays in place and turns into a close button, while a glass menu
 * scales up from its corner. Closing reverses it back into the button.
 */
export default function QuickActionsModal() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const bottom = useTabBarBottomOffset();
  const isClosing = useRef(false);

  const actions: ActionItem[] = [
    { icon: PencilSquareIcon, title: t('common:quickActionsMenu.logRide'), color: colors.glassActiveFill, href: '/home/manual-entry' },
    { icon: StarIcon, title: t('common:quickActionsMenu.rateRoutes'), color: colors.accent, href: '/home/unrated-trips' },
    { icon: UserGroupIcon, title: t('common:quickActionsMenu.createGroup'), color: colors.glassActiveFill, href: '/clubs/create' },
    { icon: MegaphoneIcon, title: t('common:quickActionsMenu.shareUpdate'), color: colors.glassActiveFill, href: '/posts/share-trip' },
  ];

  // 0 = collapsed into the "+" button, 1 = fully open.
  const progress = useSharedValue(0);
  const items = [useSharedValue(0), useSharedValue(0), useSharedValue(0), useSharedValue(0)];

  useEffect(() => {
    progress.value = withSpring(1, OPEN_SPRING);
    // Stagger from the bottom item (nearest the button) upwards.
    items.forEach((item, i) => {
      item.value = withDelay((items.length - 1 - i) * STAGGER + 60, withSpring(1, OPEN_SPRING));
    });
    // Shared values are stable refs; run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = (then?: () => void) => {
    if (isClosing.current) return;
    isClosing.current = true;
    const timing = { duration: CLOSE_DURATION, easing: Easing.in(Easing.cubic) };
    progress.value = withTiming(0, timing);
    items.forEach((item) => {
      item.value = withTiming(0, { ...timing, duration: CLOSE_DURATION * 0.7 });
    });
    setTimeout(() => {
      router.back();
      then?.();
    }, CLOSE_DURATION);
  };

  const handleAction = (href: Href) => {
    if (process.env.EXPO_OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    close(() => router.push(href));
  };

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
  }));

  // Grow from the bottom-left corner, right where the "+" bubble sits.
  const menuStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [MENU_GAP + TAB_BAR_ACTION_SIZE / 2, 0]) },
      { scale: interpolate(progress.value, [0, 1], [0.05, 1]) },
    ],
  }));

  // "+" rotates into an "×".
  const closeIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(progress.value, [0, 1], [0, 135])}deg` }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.backdrop }, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => close()} />
      </Animated.View>

      <Animated.View
        style={[
          styles.menu,
          { bottom: bottom + TAB_BAR_ACTION_SIZE + MENU_GAP, shadowColor: colors.shadow },
          menuStyle,
        ]}
      >
        <GlassSurface borderRadius={MENU_RADIUS} />
        {actions.map((action, i) => (
          <MenuRow key={action.title} action={action} appear={items[i]} onPress={() => handleAction(action.href)} />
        ))}
      </Animated.View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common:quickActionsMenu.close')}
        onPress={() => close()}
        style={[styles.closeButton, { bottom, shadowColor: colors.shadow }]}
      >
        <GlassSurface borderRadius={TAB_BAR_ACTION_SIZE / 2} interactive />
        <Animated.View style={closeIconStyle}>
          <PlusIcon size={28} color={colors.glassTint} />
        </Animated.View>
      </Pressable>
    </View>
  );
}

function MenuRow({ action, appear, onPress }: { action: ActionItem; appear: SharedValue<number>; onPress: () => void }) {
  const Icon = action.icon;
  const pressed = useSharedValue(0);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(appear.value, [0, 1], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(appear.value, [0, 1], [14, 0]) },
      { scale: interpolate(pressed.value, [0, 1], [1, 0.96]) },
    ],
  }));

  return (
    <Animated.View style={style}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        onPressIn={() => {
          pressed.value = withSpring(1, OPEN_SPRING);
        }}
        onPressOut={() => {
          pressed.value = withSpring(0, OPEN_SPRING);
        }}
        style={styles.row}
      >
        <View style={[styles.rowIcon, { backgroundColor: action.color }]}>
          <Icon size={22} color="#fff" />
        </View>
        <ThemedText style={styles.rowText}>{action.title}</ThemedText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  menu: {
    position: 'absolute',
    left: TAB_BAR_MARGIN,
    minWidth: 240,
    padding: 8,
    borderRadius: MENU_RADIUS,
    transformOrigin: 'left bottom',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 20,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rowText: {
    fontSize: 15,
    fontWeight: '600',
  },
  closeButton: {
    position: 'absolute',
    left: TAB_BAR_MARGIN,
    width: TAB_BAR_ACTION_SIZE,
    height: TAB_BAR_ACTION_SIZE,
    borderRadius: TAB_BAR_ACTION_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
  },
});
