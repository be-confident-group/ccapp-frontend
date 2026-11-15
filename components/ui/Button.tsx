import React from 'react';
import {
  Platform,
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { GlassSurface } from '@/components/ui/GlassSurface';
import { Springs } from '@/constants/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const GLASS_RADIUS = 999;
// Material buttons are fully rounded, use a 1dp outline and show a ripple.
const MATERIAL = Platform.OS === 'android';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'text' | 'danger' | 'glass';
export type ButtonSize = 'small' | 'medium' | 'large';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  style,
  textStyle,
}: ButtonProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const inactive = disabled || loading;

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePressIn = () => {
    if (inactive) return;
    scale.value = withSpring(0.96, Springs.press);
    if (process.env.EXPO_OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, Springs.press);
  };

  const getButtonStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      ...styles.base,
      ...styles[size],
    };

    if (fullWidth) {
      baseStyle.width = '100%';
    }

    switch (variant) {
      case 'primary':
        return {
          ...baseStyle,
          backgroundColor: disabled ? colors.border : colors.primary,
        };
      case 'secondary':
        return {
          ...baseStyle,
          backgroundColor: disabled ? colors.border : colors.secondary,
        };
      case 'outline':
        return {
          ...baseStyle,
          backgroundColor: 'transparent',
          borderWidth: MATERIAL ? 1 : 2,
          borderColor: disabled ? colors.border : colors.glassTint,
        };
      case 'text':
        return {
          ...baseStyle,
          backgroundColor: 'transparent',
          paddingHorizontal: 8,
        };
      case 'danger':
        return {
          ...baseStyle,
          backgroundColor: disabled ? colors.border : '#F44336',
        };
      case 'glass':
        return {
          ...baseStyle,
          borderRadius: GLASS_RADIUS,
          backgroundColor: 'transparent',
        };
      default:
        return baseStyle;
    }
  };

  const getTextStyle = (): TextStyle => {
    const baseTextStyle: TextStyle = {
      ...styles.text,
      ...styles[`${size}Text` as keyof typeof styles],
    };

    switch (variant) {
      case 'primary':
      case 'secondary':
      case 'danger':
        return {
          ...baseTextStyle,
          color: disabled ? colors.textSecondary : '#fff',
        };
      case 'outline':
        return {
          ...baseTextStyle,
          color: disabled ? colors.textSecondary : colors.glassTint,
        };
      case 'text':
        return {
          ...baseTextStyle,
          color: disabled ? colors.textSecondary : colors.glassTint,
        };
      case 'glass':
        return {
          ...baseTextStyle,
          color: disabled ? colors.textSecondary : colors.glassTint,
        };
      default:
        return baseTextStyle;
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <ActivityIndicator
          size={size === 'small' ? 'small' : 'small'}
          color={variant === 'outline' || variant === 'text'
              ? colors.glassTint
              : variant === 'glass'
                ? colors.glassTint
                : '#fff'}
        />
      );
    }

    return (
      <View style={styles.content}>
        {icon && iconPosition === 'left' && <View style={styles.iconLeft}>{icon}</View>}
        <Text style={[getTextStyle(), textStyle]}>{title}</Text>
        {icon && iconPosition === 'right' && <View style={styles.iconRight}>{icon}</View>}
      </View>
    );
  };

  return (
    <AnimatedPressable
      style={[getButtonStyle(), style, animatedStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      android_ripple={{
        color: variant === 'primary' || variant === 'secondary' || variant === 'danger'
          ? 'rgba(255, 255, 255, 0.24)'
          : colors.glassHighlight,
      }}
    >
      {variant === 'glass' && <GlassSurface borderRadius={GLASS_RADIUS} interactive />}
      {renderContent()}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: MATERIAL ? 999 : 12,
    // Clips the ripple to the button's shape.
    overflow: MATERIAL ? 'hidden' : 'visible',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  small: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 36,
  },
  medium: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    minHeight: 48,
  },
  large: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    minHeight: 56,
  },
  text: {
    fontWeight: '600',
    textAlign: 'center',
  },
  smallText: {
    fontSize: 14,
  },
  mediumText: {
    fontSize: 16,
  },
  largeText: {
    fontSize: 18,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
});
