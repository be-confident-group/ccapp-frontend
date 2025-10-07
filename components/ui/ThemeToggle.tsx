import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SunIcon, MoonIcon, DevicePhoneMobileIcon } from 'react-native-heroicons/solid';
import { useTheme } from '@/contexts/ThemeContext';

export default function ThemeToggle() {
  const { themeMode, setThemeMode, colors } = useTheme();

  const themes = [
    { mode: 'light' as const, icon: SunIcon, label: 'Light' },
    { mode: 'dark' as const, icon: MoonIcon, label: 'Dark' },
    { mode: 'system' as const, icon: DevicePhoneMobileIcon, label: 'System' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {themes.map(({ mode, icon: Icon, label }) => {
        const isActive = themeMode === mode;
        return (
          <TouchableOpacity
            key={mode}
            style={[
              styles.option,
              isActive && { backgroundColor: colors.primary },
            ]}
            onPress={() => setThemeMode(mode)}
            activeOpacity={0.7}
          >
            <Icon
              size={24}
              color={isActive ? '#fff' : colors.icon}
            />
            <Text
              style={[
                styles.label,
                { color: isActive ? '#fff' : colors.text },
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
  },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
});
