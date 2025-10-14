import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from './AuthContext';

export function useProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const rootSegment = segments[0] || '';

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
    // redirect them to the main tabs screen.
    if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
      return;
    }
  }, [isAuthenticated, isLoading, rootSegment, router, segments]);
}
