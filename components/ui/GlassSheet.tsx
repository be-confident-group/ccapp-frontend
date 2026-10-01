import React, { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { XMarkIcon } from 'react-native-heroicons/outline';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { GlassButton } from '@/components/ui/GlassButton';
import { GlassSurface } from '@/components/ui/GlassSurface';
import { useTheme } from '@/contexts/ThemeContext';

const OPEN_SPRING = { damping: 20, stiffness: 220, mass: 0.9 };
const CLOSE_DURATION = 220;
const SHEET_RADIUS = 32;
const SHEET_INSET = 10;
const DISMISS_DISTANCE = 100;
const DISMISS_VELOCITY = 800;

interface GlassSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Optional title shown in the header row next to the close button. */
  title?: string;
  /** Scrollable body. */
  children: ReactNode;
  /** Pinned below the scrolling body (e.g. a submit button). */
  footer?: ReactNode;
  /** Max sheet height in px. Defaults to 85% of the window. */
  maxHeight?: number;
}

/**
 * Floating Liquid Glass bottom sheet. Slides up with a spring, follows the
 * finger when dragged by the header, and always plays the reverse animation
 * before calling `onClose` (backdrop tap, close button, swipe, Android back).
 */
export function GlassSheet({ visible, onClose, title, children, footer, maxHeight }: GlassSheetProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  const [mounted, setMounted] = useState(visible);
  // 0 = off-screen, 1 = presented.
  const progress = useSharedValue(0);
  const drag = useSharedValue(0);
  const closing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const animateOut = useCallback(
    (then: () => void) => {
      progress.value = withTiming(0, { duration: CLOSE_DURATION, easing: Easing.in(Easing.cubic) });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(then, CLOSE_DURATION);
    },
    [progress]
  );

  useEffect(() => {
    if (visible) {
      closing.current = false;
      drag.value = 0;
      setMounted(true);
      progress.value = withSpring(1, OPEN_SPRING);
      if (process.env.EXPO_OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } else if (closing.current) {
      // Already animated out via requestClose.
      setMounted(false);
    } else {
      // Parent hid the sheet directly: still play the exit.
      closing.current = true;
      animateOut(() => setMounted(false));
    }
  }, [visible, animateOut, drag, progress]);

  useEffect(() => clearTimer, []);

  const requestClose = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    animateOut(onClose);
  }, [animateOut, onClose]);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      drag.value = e.translationY > 0 ? e.translationY : e.translationY / 6;
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
        runOnJS(requestClose)();
      } else {
        drag.value = withSpring(0, OPEN_SPRING);
      }
    });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * windowHeight + drag.value }],
  }));

  if (!mounted) return null;

  const bottomMargin = Math.max(insets.bottom - 8, SHEET_INSET);
  const sheetMaxHeight = maxHeight ?? windowHeight * 0.85 - insets.top;

  return (
    <Modal transparent animationType="none" visible onRequestClose={requestClose} statusBarTranslucent>
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.backdrop }, backdropStyle]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common:buttons.close')}
            style={StyleSheet.absoluteFill}
            onPress={requestClose}
          />
        </Animated.View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          pointerEvents="box-none"
          style={styles.avoider}
        >
          <Animated.View
            accessibilityViewIsModal
            style={[
              styles.sheet,
              {
                maxHeight: sheetMaxHeight,
                marginHorizontal: SHEET_INSET,
                marginBottom: bottomMargin,
                shadowColor: colors.shadow,
              },
              sheetStyle,
            ]}
          >
            <GlassSurface borderRadius={SHEET_RADIUS} />

            <GestureDetector gesture={pan}>
              <View collapsable={false}>
                <View style={styles.grabberArea}>
                  <View style={[styles.grabber, { backgroundColor: colors.glassInactive }]} />
                </View>
                <View style={styles.header}>
                  {title ? (
                    <ThemedText style={[styles.title, { color: colors.glassTint }]} numberOfLines={1}>
                      {title}
                    </ThemedText>
                  ) : (
                    <View style={styles.flex} />
                  )}
                  <GlassButton
                    size={36}
                    accessibilityLabel={t('common:buttons.close')}
                    onPress={requestClose}
                  >
                    <XMarkIcon size={18} color={colors.glassTint} />
                  </GlassButton>
                </View>
              </View>
            </GestureDetector>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              bounces={false}
            >
              {children}
            </ScrollView>

            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  avoider: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderRadius: SHEET_RADIUS,
    flexShrink: 1,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 16,
  },
  grabberArea: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 3,
    opacity: 0.5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 22,
    paddingRight: 14,
    minHeight: 40,
    paddingBottom: 6,
  },
  flex: {
    flex: 1,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    marginRight: 12,
  },
  scroll: {
    flexShrink: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
});
