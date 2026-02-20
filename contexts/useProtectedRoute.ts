import { useEffect, useRef } from 'react';
import { useRouter, useSegments } from 'expo-router';
import * as Linking from 'expo-linking';
import { useAuth } from './AuthContext';

export function useProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const rootSegment = segments[0] || '';
  const initialUrlHandled = useRef(false);

  useEffect(() => {
    // Return early if authentication state is still loading
    if (isLoading) return;

    const inAuthGroup = rootSegment === '(auth)';

    // If the user is not authenticated and is not in the auth group,
    // redirect them to the welcome screen.
    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/welcome');
      return;
    }

    // If the user is authenticated and is in the auth group,
    // check for a deep link that launched the app before going to tabs.
    if (isAuthenticated && inAuthGroup) {
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
  }, [isAuthenticated, isLoading, rootSegment, router, segments]);
}
