import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'text' | 'danger';
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
          backgroundColor: disabled ? '#ccc' : colors.primary,
        };
      case 'secondary':
        return {
          ...baseStyle,
          backgroundColor: disabled ? '#e0e0e0' : colors.secondary,
        };
      case 'outline':
        return {
          ...baseStyle,
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderColor: disabled ? '#ccc' : colors.primary,
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
          backgroundColor: disabled ? '#ccc' : '#F44336',
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
          color: disabled ? '#888' : '#fff',
        };
      case 'outline':
        return {
          ...baseTextStyle,
          color: disabled ? '#ccc' : colors.primary,
        };
      case 'text':
        return {
          ...baseTextStyle,
          color: disabled ? '#ccc' : colors.primary,
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
          color={variant === 'outline' || variant === 'text' ? colors.primary : '#fff'}
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
    <TouchableOpacity
      style={[getButtonStyle(), style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {renderContent()}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
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
