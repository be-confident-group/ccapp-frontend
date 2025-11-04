import { useTheme } from '@/contexts/ThemeContext';
import type { MapViewMode } from '@/types/mapMode';
import { MAP_MODE_LABELS } from '@/types/mapMode';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface MapModeToggleProps {
  activeMode: MapViewMode;
  onModeChange: (mode: MapViewMode) => void;
}

export function MapModeToggle({ activeMode, onModeChange }: MapModeToggleProps) {
  const { colors, isDark } = useTheme();
  const containerBackground = isDark ? colors.card : '#F5F5F5';
  const inactiveTextColor = isDark ? colors.textSecondary : '#4A4A4A';
  const pressedBackground = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';

  const modes: Array<{ key: MapViewMode; label: string }> = [
    { key: 'heatmap', label: MAP_MODE_LABELS.viewMode.heatmap },
    { key: 'feedback', label: MAP_MODE_LABELS.viewMode.feedback },
  ];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: containerBackground,
          borderColor: colors.border,
        },
      ]}
    >
      {modes.map((mode) => {
        const isActive = activeMode === mode.key;

        return (
          <Pressable
            key={mode.key}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`${mode.label} mode`}
            onPress={() => onModeChange(mode.key)}
            android_ripple={{ color: colors.primary + '20', borderless: false }}
            style={({ pressed }) => [
              styles.button,
              {
                backgroundColor: isActive
                  ? colors.primary
                  : pressed
                  ? pressedBackground
                  : 'transparent',
                borderColor: isActive ? colors.primary : 'transparent',
              },
            ]}
          >
            <Text
              style={[
                styles.label,
                {
                  color: isActive ? '#FFFFFF' : inactiveTextColor,
                },
              ]}
            >
              {mode.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 24,
    padding: 4,
    alignSelf: 'flex-start',
    borderWidth: 1,
    gap: 4,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 18,
    minWidth: 105,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
  },
});
