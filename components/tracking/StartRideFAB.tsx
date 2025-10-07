import { useTheme } from '@/contexts/ThemeContext';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface StartRideFABProps {
  onPress?: () => void;
}

export default function StartRideFAB({ onPress }: StartRideFABProps) {
  const { colors } = useTheme();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      // TODO: Navigate to active ride tracking screen
      console.log('Start Ride pressed');
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.fab,
        {
          backgroundColor: colors.primary,
          shadowColor: colors.shadow,
        },
      ]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <View style={styles.content}>
        <Text style={styles.icon}>🚴</Text>
        <Text style={styles.text}>Start a Ride</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 25, // Hovering slightly above the tab bar (80px tall)
    left: 20,
    right: 20,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    fontSize: 24,
  },
  text: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
