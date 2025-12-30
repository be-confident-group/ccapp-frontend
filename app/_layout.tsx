import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { UnitsProvider } from '@/contexts/UnitsContext';
import { TrackingProvider } from '@/contexts/TrackingContext';
import { QueryProvider } from '@/providers/QueryProvider';
import { useProtectedRoute } from '@/contexts/useProtectedRoute';
import { initializeMapbox } from '@/config/mapbox';

// Initialize i18n
import '@/lib/i18n';

// Initialize Mapbox
initializeMapbox();

export const unstable_settings = {
  // Start with auth flow - will be changed to (tabs) after login
  initialRouteName: '(auth)',
};

function RootLayoutNav() {
  const { colorScheme } = useTheme();
  useProtectedRoute();

  return (
    <NavigationThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        <Stack.Screen
          name="modals/quick-actions-modal"
          options={{
            presentation: 'transparentModal',
            animation: 'fade',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="feedback"
          options={{
            presentation: 'card',
            headerShown: false,
          }}
        />
      </Stack>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <QueryProvider>
          <UnitsProvider>
            <TrackingProvider>
              <RootLayoutNav />
            </TrackingProvider>
          </UnitsProvider>
        </QueryProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
