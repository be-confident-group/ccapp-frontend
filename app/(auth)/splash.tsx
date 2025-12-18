import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { authApi } from '@/lib/api';

export default function SplashScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  useEffect(() => {
    // Check authentication status and navigate accordingly
    const checkAuth = async () => {
      try {
        const isAuthenticated = await authApi.isAuthenticated();

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
        <Image
          source={require('@/assets/images/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.appName}>Radzi</Text>
        <Text style={styles.tagline}>Walk, Cycle, Connect</Text>
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
  logo: {
    width: 120,
    height: 120,
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
