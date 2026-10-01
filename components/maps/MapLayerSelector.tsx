import React, { useEffect, useRef } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { CheckIcon } from 'react-native-heroicons/solid';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { GlassSurface } from '@/components/ui/GlassSurface';
import { useTheme } from '@/contexts/ThemeContext';
import type { MapLayerPreference } from '@/lib/hooks/useMapLayer';

export type { MapLayer } from '@/lib/hooks/useMapLayer';

// 'auto' is the light/dark style that follows the app theme.
const LAYERS: MapLayerPreference[] = ['auto', 'streets', 'outdoors', 'satellite'];

const OPEN_SPRING = { damping: 18, stiffness: 240, mass: 0.8 };
const CLOSE_DURATION = 160;
const RADIUS = 24;

/** On-screen frame of the button the menu grows out of (from `measureInWindow`). */
export interface MenuAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

const ANCHOR_GAP = 8;

interface MapLayerSelectorProps {
  anchor: MenuAnchor;
  selectedLayer: MapLayerPreference;
  /** Called after the close animation with the chosen layer. */
  onLayerChange: (layer: MapLayerPreference) => void;
  /** Called after the close animation when dismissed without a choice. */
  onClose: () => void;
}

/**
 * Glass map-style menu that grows out of the layers button: it sits just left
 * of `anchor`, top-aligned with it, and scales from that corner. Tapping
 * outside dismisses it.
 */
export function MapLayerSelector({ anchor, selectedLayer, onLayerChange, onClose }: MapLayerSelectorProps) {
  const { t } = useTranslation('maps');
  const { colors } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const progress = useSharedValue(0);
  const isClosing = useRef(false);

  useEffect(() => {
    progress.value = withSpring(1, OPEN_SPRING);
  }, [progress]);

  const close = (then: () => void) => {
    if (isClosing.current) return;
    isClosing.current = true;
    progress.value = withTiming(0, { duration: CLOSE_DURATION, easing: Easing.in(Easing.cubic) });
    setTimeout(then, CLOSE_DURATION);
  };

  const menuStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.05, 1]) }],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.4, 1], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <Modal visible transparent animationType="none" onRequestClose={() => close(onClose)}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => close(onClose)} />
      <Animated.View
        style={[
          styles.menu,
          { top: anchor.y, right: screenWidth - anchor.x + ANCHOR_GAP, shadowColor: colors.shadow },
          menuStyle,
        ]}
      >
        <GlassSurface borderRadius={RADIUS} />
        <Animated.View style={contentStyle}>
          <Text style={[styles.title, { color: colors.glassInactive }]}>{t('mapStyles.title')}</Text>
          {LAYERS.map((layer) => {
            const isSelected = selectedLayer === layer;
            return (
              <Pressable
                key={layer}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                onPressIn={() => {
                  if (process.env.EXPO_OS !== 'web') Haptics.selectionAsync();
                }}
                onPress={() => close(() => onLayerChange(layer))}
                style={({ pressed }) => [
                  styles.option,
                  (pressed || isSelected) && { backgroundColor: colors.glassHighlight },
                ]}
              >
                <View style={styles.optionText}>
                  <Text style={[styles.label, { color: colors.text }]}>{t(`mapStyles.${layer}.label`)}</Text>
                  <Text style={[styles.description, { color: colors.glassInactive }]}>
                    {t(`mapStyles.${layer}.description`)}
                  </Text>
                </View>
                {isSelected && <CheckIcon size={18} color={colors.glassTint} />}
              </Pressable>
            );
          })}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  menu: {
    position: 'absolute',
    width: 240,
    padding: 6,
    borderRadius: RADIUS,
    transformOrigin: 'right top',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 18,
  },
  optionText: {
    flex: 1,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
  },
  description: {
    fontSize: 12,
    marginTop: 1,
  },
});
