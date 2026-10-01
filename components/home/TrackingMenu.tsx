import React, { useEffect, useRef } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { BoltIcon, UserIcon } from 'react-native-heroicons/solid';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { GlassSurface } from '@/components/ui/GlassSurface';
import { useTheme } from '@/contexts/ThemeContext';

export interface AnchorFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TrackingMenuProps {
  visible: boolean;
  anchor: AnchorFrame;
  isTracking: boolean;
  /** Called with the chosen state after the close animation finishes. */
  onSelect: (tracking: boolean) => void;
  onClose: () => void;
}

const OPEN_SPRING = { damping: 18, stiffness: 220, mass: 0.8 };
const CLOSE_DURATION = 170;
const STAGGER = 45;
const MENU_RADIUS = 24;
const MENU_GAP = 8;
const MENU_MIN_WIDTH = 300;
const SCREEN_MARGIN = 16;

/** Glass popover that grows out of the tracking tile and shrinks back into it on close. */
export function TrackingMenu({ visible, anchor, isTracking, onSelect, onClose }: TrackingMenuProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const progress = useSharedValue(0);
  const rowOn = useSharedValue(0);
  const rowOff = useSharedValue(0);
  const isClosing = useRef(false);

  useEffect(() => {
    if (!visible) return;
    isClosing.current = false;
    progress.value = withSpring(1, OPEN_SPRING);
    rowOn.value = withDelay(60, withSpring(1, OPEN_SPRING));
    rowOff.value = withDelay(60 + STAGGER, withSpring(1, OPEN_SPRING));
    // Shared values are stable refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const close = (selection?: boolean) => {
    if (isClosing.current) return;
    isClosing.current = true;
    const timing = { duration: CLOSE_DURATION, easing: Easing.in(Easing.cubic) };
    rowOn.value = withTiming(0, { ...timing, duration: CLOSE_DURATION * 0.6 });
    rowOff.value = withTiming(0, { ...timing, duration: CLOSE_DURATION * 0.6 });
    progress.value = withTiming(0, timing, (finished) => {
      if (finished) runOnJS(finish)(selection);
    });
  };

  const finish = (selection?: boolean) => {
    onClose();
    if (selection !== undefined) onSelect(selection);
  };

  const handleSelect = (tracking: boolean) => {
    if (process.env.EXPO_OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    close(tracking);
  };

  const width = Math.min(Math.max(anchor.width, MENU_MIN_WIDTH), screenWidth - SCREEN_MARGIN * 2);
  const left = Math.min(Math.max(anchor.x, SCREEN_MARGIN), screenWidth - width - SCREEN_MARGIN);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
  }));

  // Origin sits at the tile's top-left corner relative to the menu.
  const menuStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.15, 1]) }],
  }));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => close()}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.backdrop }, backdropStyle]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => close()}
          accessibilityRole="button"
          accessibilityLabel={t('common:buttons.close')}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.menu,
          {
            top: anchor.y + anchor.height + MENU_GAP,
            left,
            width,
            shadowColor: colors.shadow,
            transformOrigin: `${Math.max(anchor.x - left, 0) + 24}px 0px`,
          },
          menuStyle,
        ]}
      >
        <GlassSurface borderRadius={MENU_RADIUS} />
        <MenuRow
          appear={rowOn}
          selected={isTracking}
          icon={<BoltIcon size={18} color="#fff" />}
          iconColor={colors.trackingActive}
          title={t('home:header.tracking.on')}
          subtitle={t('home:header.tracking.subtitle')}
          onPress={() => handleSelect(true)}
        />
        <MenuRow
          appear={rowOff}
          selected={!isTracking}
          icon={<UserIcon size={18} color="#fff" />}
          iconColor="#9CA3AF"
          title={t('home:header.tracking.off')}
          subtitle={t('home:header.tracking.offSubtitle')}
          onPress={() => handleSelect(false)}
        />
      </Animated.View>
    </Modal>
  );
}

interface MenuRowProps {
  appear: SharedValue<number>;
  selected: boolean;
  icon: React.ReactNode;
  iconColor: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}

function MenuRow({ appear, selected, icon, iconColor, title, subtitle, onPress }: MenuRowProps) {
  const { colors } = useTheme();
  const pressed = useSharedValue(0);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(appear.value, [0, 1], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(appear.value, [0, 1], [-10, 0]) },
      { scale: interpolate(pressed.value, [0, 1], [1, 0.97]) },
    ],
  }));

  return (
    <Animated.View style={style}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={onPress}
        onPressIn={() => {
          pressed.value = withSpring(1, OPEN_SPRING);
        }}
        onPressOut={() => {
          pressed.value = withSpring(0, OPEN_SPRING);
        }}
        style={[styles.row, selected && { backgroundColor: colors.glassHighlight }]}
      >
        <View style={[styles.rowIcon, { backgroundColor: iconColor }]}>{icon}</View>
        <View style={styles.rowText}>
          <ThemedText style={styles.rowTitle}>{title}</ThemedText>
          <ThemedText style={[styles.rowSubtitle, { color: colors.textSecondary }]}>{subtitle}</ThemedText>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  menu: {
    position: 'absolute',
    padding: 6,
    borderRadius: MENU_RADIUS,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: MENU_RADIUS - 6,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  rowSubtitle: {
    fontSize: 12,
  },
});
