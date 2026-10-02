import React, { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Header from '@/components/layout/Header';
import { useTheme } from '@/contexts/ThemeContext';
import { useKeyboardVisible } from './useKeyboardVisible';

const HEADER_HEIGHT = 56;

interface PostsScreenProps {
  title: string;
  children: ReactNode;
  /** Scrolling content (default). When false, children are laid out in a centred, non-scrolling area. */
  scroll?: boolean;
  /** Pinned below the content, above the keyboard / safe area. */
  footer?: ReactNode;
  /** `bar` is an opaque bottom bar; `floating` leaves the background clear for a glass control. */
  footerVariant?: 'bar' | 'floating';
  /** Trailing header element (e.g. a GlassButton). */
  headerRight?: ReactNode;
  /** Lift content (and footer) above the keyboard. */
  keyboardAvoiding?: boolean;
}

/**
 * Shared shell for the posts / sharing screens: backgroundSecondary page, glass back header with
 * a scroll-driven backdrop, and an optional footer pinned above the keyboard.
 */
export function PostsScreen({
  title,
  children,
  scroll = true,
  footer,
  footerVariant = 'bar',
  headerRight,
  keyboardAvoiding = false,
}: PostsScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const topInset = insets.top + HEADER_HEIGHT;

  const body = scroll ? (
    <Animated.ScrollView
      style={styles.flex}
      contentContainerStyle={{
        paddingTop: topInset + 12,
        paddingBottom: footer ? 24 : insets.bottom + 32,
      }}
      onScroll={onScroll}
      scrollEventThrottle={16}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentInsetAdjustmentBehavior="never"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </Animated.ScrollView>
  ) : (
    <View style={[styles.center, { paddingTop: topInset, paddingBottom: insets.bottom }]}>{children}</View>
  );

  const footerView = footer ? (
    <View
      style={[
        styles.footer,
        { paddingBottom: keyboardVisible ? 8 : Math.max(insets.bottom, 12) },
        footerVariant === 'bar' && {
          backgroundColor: colors.backgroundSecondary,
          borderTopColor: colors.glassBorder,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
      ]}
    >
      {footer}
    </View>
  ) : null;

  const content = (
    <>
      {body}
      {footerView}
    </>
  );

  return (
    <View style={[styles.flex, { backgroundColor: colors.backgroundSecondary }]}>
      {keyboardAvoiding ? (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
      <View style={styles.header} pointerEvents="box-none">
        <Header
          title={title}
          showBack
          scrollY={scrollY}
          rightElement={headerRight}
          style={{ paddingTop: insets.top, minHeight: topInset }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { position: 'absolute', top: 0, left: 0, right: 0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: 16, paddingTop: 12 },
});
