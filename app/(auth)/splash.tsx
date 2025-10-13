import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { MapPinIcon } from 'react-native-heroicons/solid';

export default function SplashScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  useEffect(() => {
    // Navigate to welcome screen after 2 seconds
    const timer = setTimeout(() => {
      router.replace('/(auth)/welcome');
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.primary }]}>
      <View style={styles.logoContainer}>
        <View style={styles.iconWrapper}>
          <MapPinIcon color="#FFFFFF" size={80} />
        </View>
        <Text style={styles.appName}>BeActive</Text>
        <Text style={styles.tagline}>Track Your Journey</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  iconWrapper: {
    marginBottom: 24,
  },
  appName: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 18,
    color: '#FFFFFF',
    opacity: 0.9,
  },
});
