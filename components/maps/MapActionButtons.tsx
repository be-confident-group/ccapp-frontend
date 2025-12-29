import { Spacing, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

interface MapActionButtonsProps {
  onLayersPress: () => void;
  onFindLocation: () => void;
}

export function MapActionButtons({
  onLayersPress,
  onFindLocation,
}: MapActionButtonsProps) {
  const { colors } = useTheme();

  const buttonStyle = {
    backgroundColor: colors.card,
    borderColor: colors.border,
  };

  return (
    <View style={styles.container}>
      {/* Layers Button */}
      <Pressable
        style={[styles.button, buttonStyle]}
        onPress={onLayersPress}
        android_ripple={{ color: colors.primary + '20' }}
      >
        <MaterialIcons name="layers" size={22} color={colors.text} />
      </Pressable>

      {/* Find My Location Button */}
      <Pressable
        style={[styles.button, buttonStyle]}
        onPress={onFindLocation}
        android_ripple={{ color: colors.primary + '20' }}
      >
        <MaterialIcons name="my-location" size={22} color={colors.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  button: {
    width: 41,
    height: 41,
    borderRadius: BorderRadius.sm,
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
