// CRITICAL: Import LocationTrackingService FIRST to register background task
// This ensures TaskManager.defineTask() executes before any location updates arrive
import '@/lib/services/LocationTrackingService';
import { TrackingCoordinator } from '@/lib/services/TrackingCoordinator';

import * as Notifications from 'expo-notifications';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';

// Configure how notifications are handled when the app is in the foreground.
// Trip-recording local notifications are always shown.
// Remote push notifications (from the server) are also shown.
// All other local notifications are suppressed.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const isTripRecording = notification.request.identifier?.startsWith('trip-recording-');
    // Remote pushes have a trigger type of 'push'; local ones have 'calendar', 'interval', etc.
    const isRemotePush =
      notification.request.trigger != null &&
      (notification.request.trigger as { type?: string }).type === 'push';
    const data = notification.request.content.data as any;
    const isTripCompletion =
      data?.type === 'trip_completed' || data?.type === 'rate_trip';
    const shouldShow = isTripRecording || isRemotePush || isTripCompletion;
    return {
      shouldShowAlert: shouldShow,
      shouldShowBanner: shouldShow,
      shouldShowList: shouldShow,
      shouldPlaySound: isRemotePush,
      shouldSetBadge: false,
    };
  },
});
import { Stack, router } from 'expo-router';
import { useEffect } from 'react';
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

  // Initialize TrackingCoordinator early so engine preference and native subscriptions are ready
  useEffect(() => {
    TrackingCoordinator.init().catch(err => console.error('[App] TrackingCoordinator init failed:', err));
  }, []);

  // Handle taps on trip-completion and rate-trip notifications
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as any;
      if (data?.type === 'trip_completed' && data?.tripId) {
        router.replace(`/home/trip-detail?id=${data.tripId}`);
      } else if (data?.type === 'rate_trip' && data?.tripId) {
        router.replace(`/home/rate-route?tripId=${data.tripId}`);
      }
    });
    return () => subscription.remove();
  }, []);

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
