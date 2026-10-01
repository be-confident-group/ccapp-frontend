import React, { useCallback, useEffect, useState } from 'react';
import {
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
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
import { XMarkIcon } from 'react-native-heroicons/outline';

import { ThemedText } from '@/components/themed-text';
import { GlassButton } from '@/components/ui/GlassButton';
import { GlassSurface } from '@/components/ui/GlassSurface';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';

const ZOOM_SPRING = { damping: 17, stiffness: 220 };
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 900;

interface PhotoViewerProps {
  visible: boolean;
  photos: string[];
  initialIndex: number;
  onClose: () => void;
}

export function PhotoViewer({ visible, photos, initialIndex, onClose }: PhotoViewerProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.root}>
        <ViewerContent photos={photos} initialIndex={initialIndex} onClose={onClose} />
      </GestureHandlerRootView>
    </Modal>
  );
}

function ViewerContent({
  photos,
  initialIndex,
  onClose,
}: Omit<PhotoViewerProps, 'visible'>) {
  const { t } = useTranslation(['groups', 'common']);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(initialIndex);

  const translateY = useSharedValue(0);
  const zoom = useSharedValue(0.9);

  useEffect(() => {
    zoom.value = withSpring(1, ZOOM_SPRING);
  }, [zoom]);

  const dismiss = useCallback(() => {
    if (process.env.EXPO_OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onClose();
  }, [onClose]);

  const pan = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .failOffsetX([-15, 15])
    .onUpdate((event) => {
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      const shouldDismiss =
        Math.abs(event.translationY) > DISMISS_DISTANCE ||
        Math.abs(event.velocityY) > DISMISS_VELOCITY;
      if (shouldDismiss) {
        const direction = event.translationY >= 0 ? 1 : -1;
        runOnJS(dismiss)();
        translateY.value = withTiming(direction * height, { duration: 220 });
      } else {
        translateY.value = withSpring(0, ZOOM_SPRING);
      }
    });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(translateY.value), [0, height * 0.4], [1, 0.25], Extrapolation.CLAMP),
  }));

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      {
        scale:
          zoom.value *
          interpolate(Math.abs(translateY.value), [0, height * 0.5], [1, 0.85], Extrapolation.CLAMP),
      },
    ],
  }));

  // Chrome drifts away with the drag instead of fading (glass can't fade out).
  const chromeStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(Math.abs(translateY.value), [0, 200], [0, -70], Extrapolation.CLAMP),
      },
    ],
  }));

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (next !== index && next >= 0 && next < photos.length) setIndex(next);
  };

  return (
    <View style={styles.root}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />

      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.root, imageStyle]}>
          <Animated.ScrollView
            horizontal
            pagingEnabled
            scrollEnabled={photos.length > 1}
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: initialIndex * width, y: 0 }}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            {photos.map((uri, i) => (
              <View key={`${uri}-${i}`} style={[styles.page, { width, height }]}>
                <Image source={{ uri }} style={styles.image} resizeMode="contain" />
              </View>
            ))}
          </Animated.ScrollView>
        </Animated.View>
      </GestureDetector>

      <Animated.View
        pointerEvents="box-none"
        style={[styles.chrome, { top: insets.top + Spacing.sm }, chromeStyle]}
      >
        {photos.length > 1 ? (
          <View style={[styles.counter, { shadowColor: colors.shadow }]}>
            <GlassSurface borderRadius={16} />
            <ThemedText style={[styles.counterText, { color: colors.glassTint }]}>
              {t('groups:photoViewer.counter', {
                current: index + 1,
                total: photos.length,
                defaultValue: '{{current}} / {{total}}',
              })}
            </ThemedText>
          </View>
        ) : (
          <View />
        )}
        <GlassButton onPress={dismiss} accessibilityLabel={t('common:buttons.close')}>
          <XMarkIcon size={22} color={colors.glassTint} />
        </GlassButton>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.94)',
  },
  page: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '75%',
  },
  chrome: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  counter: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 6,
  },
  counterText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
