// CRITICAL: Import LocationTrackingService FIRST to register background task
// This ensures TaskManager.defineTask() executes before any location updates arrive
import '@/lib/services/LocationTrackingService';
import { TrackingCoordinator } from '@/lib/services/TrackingCoordinator';
import { initTrackingConfig } from '@/lib/services/TrackingConfig';

import * as Notifications from 'expo-notifications';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack, router, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';
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

// Initialize Mapbox
initializeMapbox();

export const unstable_settings = {
  // Start with auth flow - will be changed to (tabs) after login
  initialRouteName: '(auth)',
};

/** Map notification payload → the in-app path to push to. Returns null for unrecognised types. */
function notificationDataToPath(data: Record<string, unknown> | null | undefined): string | null {
  if (!data) return null;
  if (data.type === 'trip_completed' && data.tripId)
    return `/home/trip-detail?id=${data.tripId}`;
  if (data.type === 'rate_trip' && data.tripId)
    return `/home/rate-route?id=${data.tripId}`;
  if (
    (data.type === 'post_liked' || data.type === 'post_commented' || data.type === 'club_post') &&
    data.post_id
  )
    return `/feed/post-detail?id=${data.post_id}`;
  if (data.type === 'join_request' && data.club_id)
    return `/clubs/pending-requests?id=${data.club_id}`;
  if ((data.type === 'request_accepted' || data.type === 'request_rejected') && data.club_id)
    return `/clubs/${data.club_id}`;
  return null;
}

function RootLayoutNav() {
  const { colorScheme } = useTheme();
  useProtectedRoute();

  // Pending destination from a notification tap. Set by either the cold-start check or
  // the live listener; drained once the user is confirmed on the main tabs.
  const pendingNavigation = useRef<string | null>(null);
  const segments = useSegments();

  // Initialize TrackingCoordinator and remote tracking config early.
  useEffect(() => {
    TrackingCoordinator.init().catch(err => console.error('[App] TrackingCoordinator init failed:', err));
    initTrackingConfig().catch(err => console.warn('[App] TrackingConfig init failed:', err));
  }, []);

  // Cold-start: the app was launched by tapping a notification while killed.
  // addNotificationResponseReceivedListener does NOT fire in this case — we must
  // call getLastNotificationResponseAsync() to retrieve the tap.
  useEffect(() => {
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const path = notificationDataToPath(
        response.notification.request.content.data as Record<string, unknown>,
      );
      if (path) pendingNavigation.current = path;
    });
  }, []);

  // Warm: notification tap while the app is in the foreground or background.
  // Store the path the same way so it goes through the same drain logic.
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const path = notificationDataToPath(
        response.notification.request.content.data as Record<string, unknown>,
      );
      if (path) pendingNavigation.current = path;
      // Draining is handled by the segments effect below.
    });
    return () => subscription.remove();
  }, []);

  // Drain: once useProtectedRoute has settled the user onto the main tabs, consume
  // the pending notification destination. Using push so the user can press Back.
  useEffect(() => {
    if (segments[0] === '(tabs)' && pendingNavigation.current) {
      const path = pendingNavigation.current;
      pendingNavigation.current = null;
      router.push(path as never);
    }
  }, [segments]);

  return (
    <NavigationThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
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
