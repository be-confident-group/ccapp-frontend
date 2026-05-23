import { useEffect, useRef } from 'react';
import { useRouter, useSegments } from 'expo-router';
import * as Linking from 'expo-linking';
import { useAuth } from './AuthContext';

export function useProtectedRoute() {
  const { isAuthenticated, isLoading, hasCompletedOnboarding } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const rootSegment = segments[0] || '';
  const initialUrlHandled = useRef(false);

  useEffect(() => {
    // Return early if authentication state is still loading
    if (isLoading) return;

    const inAuthGroup = rootSegment === '(auth)';
    const inOnboardingGroup = rootSegment === '(onboarding)';

    // If the user is not authenticated and is not in the auth group,
    // redirect them to the welcome screen.
    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/welcome');
      return;
    }

    // While hasCompletedOnboarding is still loading (null), do not redirect.
    if (hasCompletedOnboarding === null) return;

    // If authenticated but onboarding is not complete, send to onboarding.
    // Do not redirect again if already inside the onboarding group (prevents
    // bouncing between screens in the wizard).
    if (isAuthenticated && !hasCompletedOnboarding && !inOnboardingGroup) {
      router.replace('/(onboarding)/welcome');
      return;
    }

    // If the user is authenticated and onboarding is done, ensure they leave
    // the auth or onboarding groups and reach the main app.
    // Also handles deep links that launched the app before authentication.
    if (isAuthenticated && hasCompletedOnboarding && (inAuthGroup || inOnboardingGroup)) {
      if (!initialUrlHandled.current) {
        initialUrlHandled.current = true;
        Linking.getInitialURL().then((url) => {
          if (url) {
            const parsed = Linking.parse(url);
            if (parsed.path) {
              router.replace(`/${parsed.path}` as never);
              return;
            }
          }
          router.replace('/(tabs)');
        });
      } else {
        router.replace('/(tabs)');
      }
      return;
    }
  }, [isAuthenticated, isLoading, hasCompletedOnboarding, rootSegment, router]);
}
