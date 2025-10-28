import { useTheme } from '@/contexts/ThemeContext';
import type { FeedbackMode, HeatmapMode } from '@/types/mapMode';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

interface MapSubModeToggleProps {
  mode: 'heatmap' | 'feedback';
  activeSubMode: HeatmapMode | FeedbackMode;
  onSubModeChange: (subMode: HeatmapMode | FeedbackMode) => void;
}

export function MapSubModeToggle({ mode, activeSubMode, onSubModeChange }: MapSubModeToggleProps) {
  const { colors, isDark } = useTheme();

  const subModes = mode === 'heatmap'
    ? [
        { key: 'global' as HeatmapMode, icon: 'public' },
        { key: 'personal' as HeatmapMode, icon: 'person' },
      ]
    : [
        { key: 'community' as FeedbackMode, icon: 'public' },
        { key: 'personal' as FeedbackMode, icon: 'person' },
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
      {subModes.map((subMode) => {
        const isActive = activeSubMode === subMode.key;

        return (
          <Pressable
            key={subMode.key}
            style={[
              styles.button,
              isActive && {
                backgroundColor: colors.accent,
              },
            ]}
            onPress={() => onSubModeChange(subMode.key)}
            android_ripple={{ color: colors.accent + '20' }}
          >
            <MaterialIcons 
              name={subMode.icon as any} 
              size={22} 
              color={isActive ? '#000000' : isDark ? colors.text : '#666666'} 
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    borderRadius: 20,
    padding: 3,
    gap: 2,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  button: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
