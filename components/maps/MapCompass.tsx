import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { GlassButton } from '@/components/ui/GlassButton';
import { useTheme } from '@/contexts/ThemeContext';

const SIZE = 44;
const NEEDLE_WIDTH = 6;
const NEEDLE_LENGTH = 11;

interface MapCompassProps {
  /** Map camera heading in degrees (0 = north). A shared value so the needle
   *  follows the camera on the UI thread without re-rendering the screen. */
  heading: SharedValue<number>;
  /** Called on tap, e.g. to rotate the map back to north. */
  onPress: () => void;
}

/** Glass compass button whose needle always points to map north. */
export function MapCompass({ heading, onPress }: MapCompassProps) {
  const { t } = useTranslation('maps');
  const { colors } = useTheme();

  const dialStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-heading.value}deg` }],
  }));

  return (
    <GlassButton onPress={onPress} accessibilityLabel={t('controls.resetNorth')} size={SIZE}>
      <Animated.View style={[styles.dial, dialStyle]}>
        <Text style={[styles.north, { color: colors.error }]}>N</Text>
        <View style={[styles.needleNorth, { borderBottomColor: colors.error }]} />
        <View style={[styles.needleSouth, { borderTopColor: colors.glassInactive }]} />
      </Animated.View>
    </GlassButton>
  );
}

const styles = StyleSheet.create({
  dial: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  north: {
    position: 'absolute',
    top: 1,
    fontSize: 9,
    fontWeight: '800',
  },
  // Triangles drawn with borders: a red north half and a muted south half.
  needleNorth: {
    width: 0,
    height: 0,
    marginTop: 6,
    borderLeftWidth: NEEDLE_WIDTH,
    borderRightWidth: NEEDLE_WIDTH,
    borderBottomWidth: NEEDLE_LENGTH,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  needleSouth: {
    width: 0,
    height: 0,
    borderLeftWidth: NEEDLE_WIDTH,
    borderRightWidth: NEEDLE_WIDTH,
    borderTopWidth: NEEDLE_LENGTH,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
