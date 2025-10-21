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

  const modes: Array<{ key: MapViewMode; label: string }> = [
    { key: 'heatmap', label: MAP_MODE_LABELS.viewMode.heatmap },
    { key: 'feedback', label: MAP_MODE_LABELS.viewMode.feedback },
  ];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? colors.card : '#F5F5F5',
          borderColor: colors.border,
        },
      ]}
    >
      {modes.map((mode) => {
        const isActive = activeMode === mode.key;

        return (
          <Pressable
            key={mode.key}
            style={[
              styles.button,
              isActive && {
                backgroundColor: colors.primary,
              },
            ]}
            onPress={() => onModeChange(mode.key)}
            android_ripple={{ color: colors.primary + '20' }}
          >
            <Text
              style={[
                styles.label,
                {
                  color: isActive ? '#FFFFFF' : isDark ? colors.text : '#666666',
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
    borderRadius: 23,
    padding: 3.5,
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  button: {
    paddingVertical: 9,
    paddingHorizontal: 23,
    borderRadius: 20,
    minWidth: 92,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
});
