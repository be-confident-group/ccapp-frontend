import React, { ReactNode, useEffect } from 'react';
import { Image, Pressable, StyleSheet, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MagnifyingGlassIcon, UsersIcon } from 'react-native-heroicons/outline';

import Header from '@/components/layout/Header';
import { ThemedText } from '@/components/themed-text';
import Button from '@/components/ui/Button';
import { GlassSurface } from '@/components/ui/GlassSurface';
import { useTheme } from '@/contexts/ThemeContext';

export const CLUB_HEADER_HEIGHT = 56;

const PRESS_SPRING = { damping: 15, stiffness: 400 };

/** Scroll tracking + safe-area metrics shared by the club screens. */
export function useClubScroll() {
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  return { insets, scrollY, onScroll, topInset: insets.top + CLUB_HEADER_HEIGHT + 12 };
}

/** Glass back header floating over the content, with a backdrop that fades in on scroll. */
export function ClubScreenHeader({
  title,
  scrollY,
  rightElement,
}: {
  title?: string;
  scrollY?: SharedValue<number>;
  rightElement?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.headerWrap} pointerEvents="box-none">
      <Header
        title={title}
        showBack
        scrollY={scrollY}
        rightElement={rightElement}
        style={{ paddingTop: insets.top, minHeight: insets.top + CLUB_HEADER_HEIGHT }}
      />
    </View>
  );
}

/** Staggered fade/slide-up entrance for list rows (non-glass content only). */
export function Entrance({ index = 0, children }: { index?: number; children: ReactNode }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      Math.min(index, 8) * 50,
      withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) })
    );
  }, [index, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 16 }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

/** Card with spring press-scale and a light haptic on touch-down. */
export function PressableCard({
  onPress,
  children,
  accessibilityLabel,
  style,
}: {
  onPress: () => void;
  children: ReactNode;
  accessibilityLabel?: string;
  style?: object;
}) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        onPressIn={() => {
          scale.value = withSpring(0.98, PRESS_SPRING);
          if (process.env.EXPO_OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          }
        }}
        onPressOut={() => {
          scale.value = withSpring(1, PRESS_SPRING);
        }}
        style={[styles.card, { backgroundColor: colors.card }, style]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

/** Club photo, or a plain people icon on a soft circle-ish tile. */
export function ClubThumb({ uri, size = 56 }: { uri?: string | null; size?: number }) {
  const { colors } = useTheme();
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size * 0.28 }} />;
  }
  return (
    <View
      style={[
        styles.thumbPlaceholder,
        { width: size, height: size, borderRadius: size * 0.28, backgroundColor: colors.glassHighlight },
      ]}
    >
      <UsersIcon size={size * 0.46} color={colors.glassTint} />
    </View>
  );
}

/** Glass capsule search field. */
export function ClubSearchBar({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.search}>
      <GlassSurface borderRadius={999} />
      <MagnifyingGlassIcon size={20} color={colors.glassInactive} />
      <TextInput
        style={[styles.searchInput, { color: colors.text }]}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
    </View>
  );
}

/** Centred plain icon in a 64px circle, title, text and an optional primary button. */
export function ClubEmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon: ReactNode;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyCircle, { backgroundColor: colors.glassHighlight }]}>{icon}</View>
      <ThemedText style={styles.emptyTitle}>{title}</ThemedText>
      {message ? (
        <ThemedText style={[styles.emptyMessage, { color: colors.textSecondary }]}>{message}</ThemedText>
      ) : null}
      {actionLabel && onAction ? (
        <View style={styles.emptyAction}>
          <Button title={actionLabel} onPress={onAction} style={{ borderRadius: 999 }} />
        </View>
      ) : null}
    </View>
  );
}

/** Small pill showing an icon and a short label. */
export function ClubChip({ icon, label }: { icon?: ReactNode; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.chip, { backgroundColor: colors.glassHighlight }]}>
      {icon}
      <ThemedText style={[styles.chipText, { color: colors.glassInactive }]} numberOfLines={1}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  headerWrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  card: { borderRadius: 20, padding: 16 },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  search: {
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 0 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: 32, gap: 12 },
  emptyCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '600', textAlign: 'center' },
  emptyMessage: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  emptyAction: { marginTop: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  chipText: { fontSize: 12, fontWeight: '500' },
});
