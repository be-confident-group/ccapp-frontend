import { useTheme } from '@/contexts/ThemeContext';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

interface MapCompassProps {
  heading?: number; // Compass heading in degrees (0 = North)
  onPress?: () => void; // Optional callback to reset to north
  fadeWhenNorth?: boolean; // Fade out when facing north (default: true)
}

export function MapCompass({ heading = 0, onPress, fadeWhenNorth = true }: MapCompassProps) {
  const { colors } = useTheme();
  const rotation = useSharedValue(0);

  useEffect(() => {
    // Rotate compass icon opposite to heading so North always points up
    rotation.value = withTiming(-heading, {
      duration: 300,
    });
  }, [heading]);

  const animatedStyle = useAnimatedStyle(() => {
    // Calculate opacity based on how close to north (0 degrees)
    // When heading is 0, opacity should be low (0.3)
    // When heading is far from 0, opacity should be 1
    let opacity = 1;
    if (fadeWhenNorth) {
      const headingAbs = Math.abs(rotation.value % 360);
      const distanceFromNorth = Math.min(headingAbs, 360 - headingAbs);
      // Fade out when within 15 degrees of north
      opacity = interpolate(
        distanceFromNorth,
        [0, 15], // 0-15 degrees from north
        [0.3, 1], // fade to 30% opacity
        'clamp'
      );
    }

    return {
      transform: [{ rotate: `${rotation.value}deg` }],
      opacity,
    };
  });

  const handlePress = () => {
    if (onPress) {
      onPress();
    }
  };

  return (
    <Pressable
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
      onPress={handlePress}
      android_ripple={{ color: colors.primary + '20' }}
    >
      <Animated.View style={animatedStyle}>
        <MaterialIcons name="explore" size={28} color={colors.primary} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
});
