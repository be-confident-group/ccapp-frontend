/**
 * RatedBadge Component
 *
 * A small badge indicating whether a trip has been rated or not.
 * Similar to the sync badge pattern used in trip-history.
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { CheckIcon, StarIcon } from 'react-native-heroicons/solid';
import { useTheme } from '@/contexts/ThemeContext';

interface RatedBadgeProps {
  isRated: boolean;
  size?: 'small' | 'medium';
  style?: ViewStyle;
}

export default function RatedBadge({
  isRated,
  size = 'medium',
  style,
}: RatedBadgeProps) {
  const { colors } = useTheme();

  const badgeSize = size === 'small' ? 20 : 24;
  const iconSize = size === 'small' ? 12 : 14;

  // Gold for unrated (needs attention), primary for rated
  const backgroundColor = isRated ? colors.primary : colors.accent;
  const Icon = isRated ? CheckIcon : StarIcon;

  return (
    <View
      style={[
        styles.badge,
        {
          width: badgeSize,
          height: badgeSize,
          borderRadius: badgeSize / 2,
          backgroundColor,
        },
        style,
      ]}
    >
      <Icon size={iconSize} color="#FFFFFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
