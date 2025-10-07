import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeftIcon } from 'react-native-heroicons/solid';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedText } from '@/components/themed-text';

export type HeaderVariant = 'standard' | 'minimal';

interface HeaderProps {
  title?: string;
  variant?: HeaderVariant;
  showBack?: boolean;
  onBackPress?: () => void;
  rightElement?: React.ReactNode;
  leftElement?: React.ReactNode;
  style?: ViewStyle;
}

export default function Header({
  title,
  variant = 'standard',
  showBack = false,
  onBackPress,
  rightElement,
  leftElement,
  style,
}: HeaderProps) {
  const { colors } = useTheme();

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      router.back();
    }
  };

  if (variant === 'minimal') {
    return (
      <View style={[styles.minimalContainer, style]}>
        {showBack && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBackPress}
            activeOpacity={0.7}
          >
            <ChevronLeftIcon size={28} color={colors.text} />
          </TouchableOpacity>
        )}
        {rightElement && <View style={styles.rightElement}>{rightElement}</View>}
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.leftSection}>
        {showBack ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBackPress}
            activeOpacity={0.7}
          >
            <ChevronLeftIcon size={28} color={colors.text} />
          </TouchableOpacity>
        ) : leftElement ? (
          leftElement
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>

      <View style={styles.centerSection}>
        {title && (
          <ThemedText type="subtitle" style={styles.title} numberOfLines={1}>
            {title}
          </ThemedText>
        )}
      </View>

      <View style={styles.rightSection}>
        {rightElement || <View style={styles.placeholder} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 56,
  },
  minimalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 44,
  },
  leftSection: {
    flex: 1,
    alignItems: 'flex-start',
  },
  centerSection: {
    flex: 2,
    alignItems: 'center',
  },
  rightSection: {
    flex: 1,
    alignItems: 'flex-end',
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    width: 28,
  },
  rightElement: {
    marginLeft: 'auto',
  },
});
