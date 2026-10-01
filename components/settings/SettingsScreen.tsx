import React, { ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Header from '@/components/layout/Header';
import { useTheme } from '@/contexts/ThemeContext';

const HEADER_HEIGHT = 56;

interface SettingsScreenProps {
  title: string;
  children: ReactNode;
  /** Show a centred spinner (with optional label) instead of the content. */
  loading?: boolean;
  loadingLabel?: string;
  /** Wrap the content in a KeyboardAvoidingView (forms). */
  keyboardAvoiding?: boolean;
}

/**
 * Shared shell for root-stack settings sub-pages: glass back header floating over
 * a scroll view, with the header backdrop fading in as content scrolls under it.
 */
export function SettingsScreen({
  title,
  children,
  loading = false,
  loadingLabel,
  keyboardAvoiding = false,
}: SettingsScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const body = loading ? (
    <View style={[styles.center, { paddingTop: insets.top + HEADER_HEIGHT }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      {loadingLabel ? (
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{loadingLabel}</Text>
      ) : null}
    </View>
  ) : (
    <Animated.ScrollView
      style={styles.flex}
      contentContainerStyle={{
        paddingTop: insets.top + HEADER_HEIGHT + 12,
        paddingBottom: insets.bottom + 32,
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
  );

  return (
    <View style={[styles.flex, { backgroundColor: colors.backgroundSecondary }]}>
      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
      <View style={styles.header} pointerEvents="box-none">
        <Header
          title={title}
          showBack
          scrollY={scrollY}
          style={{ paddingTop: insets.top, minHeight: insets.top + HEADER_HEIGHT }}
        />
      </View>
    </View>
  );
}

/** Small textSecondary caption placed under a SettingsGroup. */
export function SettingsFootnote({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return <Text style={[styles.footnote, { color: colors.textSecondary }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { position: 'absolute', top: 0, left: 0, right: 0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14 },
  footnote: {
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 32,
    marginTop: -16,
    marginBottom: 24,
  },
});
