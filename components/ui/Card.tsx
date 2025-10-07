import React from 'react';
import { View, StyleSheet, ViewStyle, TouchableOpacity } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

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
      borderRadius: 16,
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
          elevation: 3,
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

  if (onPress) {
    return (
      <TouchableOpacity
        style={[getCardStyle(), style]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={[getCardStyle(), style]}>{children}</View>;
}
