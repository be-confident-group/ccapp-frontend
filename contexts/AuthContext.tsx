import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi } from '@/lib/api';
import { apiClient } from '@/lib/api/client';
import type { User } from '@/lib/api/auth';
import PushNotificationService from '@/lib/services/PushNotificationService';
import * as onboardingState from '@/lib/onboarding/state';
import { clearQueryCache } from '@/providers/QueryProvider';
import { TrackingCoordinator } from '@/lib/services/TrackingCoordinator';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  hasCompletedOnboarding: boolean | null;
  currentUserId: string | number | null;
  user: User | null;
  signIn: () => void;
  signOut: () => void;
  markOnboardingComplete: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | number | null>(null);
  const [user, setUser] = useState<User | null>(null);

  /**
   * Load and cache the onboarding completion flag for a given user.
   * Runs the legacy migration once (MIGRATION_FLAG) so existing accounts
   * are not sent through the new onboarding flow.
   */
  const loadOnboardingState = useCallback(async (uid: string | number) => {
    setCurrentUserId(uid);
    const migrated = await AsyncStorage.getItem(onboardingState.MIGRATION_FLAG);
    if (!migrated) {
      // First launch after update — mark all existing users as complete
      await onboardingState.markOnboardingComplete(uid);
      await AsyncStorage.setItem(onboardingState.MIGRATION_FLAG, '1');
      setHasCompletedOnboarding(true);
    } else {
      const done = await onboardingState.isOnboardingComplete(uid);
      setHasCompletedOnboarding(done);
    }
  }, []);

  const signOut = useCallback(async () => {
    // Stop native GPS tracking before clearing any other state
    try {
      await TrackingCoordinator.stop();
    } catch (err) {
      console.warn('[Auth] TrackingCoordinator.stop() failed during sign-out:', err);
    }
    await PushNotificationService.unregister();
    await authApi.logout();
    // Clear all cached server data so the next user cannot see previous user's data
    clearQueryCache();
    setIsAuthenticated(false);
    setHasCompletedOnboarding(null);
    setCurrentUserId(null);
    setUser(null);
  }, []);

  // Register the 401 handler so the API client can trigger sign-out
  // when the backend rejects an invalid/expired token.
  useEffect(() => {
    apiClient.setOnUnauthorized(() => {
      console.warn('[Auth] Session expired — signing out');
      setIsAuthenticated(false);
    });
    return () => {
      apiClient.setOnUnauthorized(null);
    };
  }, []);

  useEffect(() => {
    async function checkAuthStatus() {
      try {
        const authenticated = await authApi.isAuthenticated();
        setIsAuthenticated(authenticated);
        if (authenticated) {
          // Re-register push token if the session is still valid (token may have rotated)
          PushNotificationService.registerForUser();
          // Fetch profile to derive user ID, then load onboarding flag
          try {
            const user = await authApi.getProfile();
            setUser(user);
            const uid = user.id ?? user.email;
            await loadOnboardingState(uid);
          } catch (profileError) {
            console.warn('[Auth] Could not fetch profile for onboarding check:', profileError);
            // Fail open: treat as complete so the user is not stuck
            setHasCompletedOnboarding(true);
          }
        }
      } catch (e) {
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    }
    checkAuthStatus();
  }, [loadOnboardingState]);

  const signIn = useCallback(() => {
    setIsAuthenticated(true);
    setHasCompletedOnboarding(null);
    // Register push token after login (best-effort, non-blocking)
    PushNotificationService.registerForUser();
    // Fetch profile to derive user ID, then load onboarding flag
    authApi.getProfile().then((user) => {
      setUser(user);
      const uid = user.id ?? user.email;
      loadOnboardingState(uid);
    }).catch((profileError) => {
      console.warn('[Auth] Could not fetch profile for onboarding check:', profileError);
      // Fail to onboarding — new users must complete setup even if profile fetch fails.
      // Existing users will also be sent to onboarding, but markOnboardingComplete persists
      // to AsyncStorage so they'll pass through immediately on the next mount.
      setHasCompletedOnboarding(false);
    });
  }, [loadOnboardingState]);

  const markOnboardingComplete = useCallback(async () => {
    if (currentUserId !== null) {
      await onboardingState.markOnboardingComplete(currentUserId);
      setHasCompletedOnboarding(true);
    } else {
      console.warn('[AuthContext] markOnboardingComplete called before currentUserId is set — ignoring');
    }
  }, [currentUserId]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        hasCompletedOnboarding,
        currentUserId,
        user,
        signIn,
        signOut,
        markOnboardingComplete,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
