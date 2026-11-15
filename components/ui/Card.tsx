import React from 'react';
import { Platform, Pressable, View, ViewStyle } from 'react-native';
import { BorderRadius } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { Touchable } from '@/components/ui/Touchable';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  noPadding?: boolean;
  variant?: 'default' | 'elevated' | 'outlined';
}

export default function Card({
  children,
  style,
  onPress,
  noPadding = false,
  variant = 'default',
}: CardProps) {
  const { colors } = useTheme();

  const getCardStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.lg,
      padding: noPadding ? 0 : 16,
    };

    switch (variant) {
      case 'elevated':
        return {
          ...baseStyle,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 1,
        };
      case 'outlined':
        return {
          ...baseStyle,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.background,
        };
      default:
        return baseStyle;
    }
  };

  // Material cards respond with a ripple instead of fading.
  if (onPress && Platform.OS === 'android') {
    return (
      <Pressable
        style={[getCardStyle(), { overflow: 'hidden' }, style]}
        onPress={onPress}
        android_ripple={{ color: colors.glassHighlight }}
      >
        {children}
      </Pressable>
    );
  }

  if (onPress) {
    return (
      <Touchable
        style={[getCardStyle(), style]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {children}
      </Touchable>
    );
  }

  return <View style={[getCardStyle(), style]}>{children}</View>;
}
