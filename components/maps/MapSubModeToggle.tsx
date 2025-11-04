import { useTheme } from '@/contexts/ThemeContext';
import type { FeedbackMode, HeatmapMode } from '@/types/mapMode';
import { MAP_MODE_LABELS } from '@/types/mapMode';
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
  const containerBackground = isDark ? colors.card : '#F5F5F5';
  const pressedBackground = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';
  const inactiveIconColor = isDark ? colors.textSecondary : '#666666';

  const subModes = mode === 'heatmap'
    ? [
        { key: 'global' as HeatmapMode, icon: 'public', label: MAP_MODE_LABELS.heatmapMode.global },
        { key: 'personal' as HeatmapMode, icon: 'person', label: MAP_MODE_LABELS.heatmapMode.personal },
      ]
    : [
        { key: 'community' as FeedbackMode, icon: 'public', label: MAP_MODE_LABELS.feedbackMode.community },
        { key: 'personal' as FeedbackMode, icon: 'person', label: MAP_MODE_LABELS.feedbackMode.personal },
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
      {subModes.map((subMode) => {
        const isActive = activeSubMode === subMode.key;

        return (
          <Pressable
            key={subMode.key}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`${subMode.label} ${mode === 'heatmap' ? 'heatmap' : 'feedback'} mode`}
            onPress={() => onSubModeChange(subMode.key)}
            android_ripple={{ color: colors.accent + '20', borderless: false }}
            style={({ pressed }) => [
              styles.button,
              {
                backgroundColor: isActive
                  ? colors.accent
                  : pressed
                  ? pressedBackground
                  : 'transparent',
                borderColor: isActive ? colors.accent : 'transparent',
              },
            ]}
          >
            <MaterialIcons 
              name={subMode.icon as any} 
              size={22} 
              color={isActive ? '#000000' : inactiveIconColor} 
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
    borderRadius: 22,
    padding: 4,
    gap: 6,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
