import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { MapPinIcon } from 'react-native-heroicons/solid';
import { authApi } from '@/lib/api';

export default function SplashScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  useEffect(() => {
    // Check authentication status and navigate accordingly
    const checkAuth = async () => {
      try {
        const isAuthenticated = await authApi.isAuthenticated();

        // Wait at least 2 seconds before navigating
        await new Promise(resolve => setTimeout(resolve, 2000));

        if (isAuthenticated) {
          // User is logged in, go to main app
          router.replace('/(tabs)');
        } else {
          // User is not logged in, go to welcome screen
          router.replace('/(auth)/welcome');
        }
      } catch (error) {
        console.error('Auth check error:', error);
        // On error, default to welcome screen
        router.replace('/(auth)/welcome');
      }
    };

    checkAuth();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.primary }]}>
      <View style={styles.logoContainer}>
        <View style={styles.iconWrapper}>
          <MapPinIcon color="#FFFFFF" size={80} />
        </View>
        <Text style={styles.appName}>Radzi</Text>
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
