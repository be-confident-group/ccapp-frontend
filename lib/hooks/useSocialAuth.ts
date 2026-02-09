import { useState, useEffect, useCallback } from 'react';
import { Platform, Alert } from 'react-native';
import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { authApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Configure Google Sign-In on module load.
 * webClientId is the Web Application client ID from Google Cloud Console.
 * This ensures the id_token's audience matches what the backend validates.
 * iosClientId is the iOS client ID for native iOS sign-in.
 *
 * Guard against missing env vars to prevent native crash on device
 * (e.g. when EAS secrets are not fully configured for a build profile).
 */
const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

if (googleWebClientId) {
  GoogleSignin.configure({
    webClientId: googleWebClientId,
    iosClientId: googleIosClientId,
    offlineAccess: true,
  });
} else {
  console.warn('[GoogleSignIn] Client IDs not configured — Google Sign-In will be unavailable');
}

export function useSocialAuth() {
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);

  // Check Apple Sign-In availability on iOS
  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setAppleAuthAvailable);
    }
  }, []);

  /**
   * Google Sign-In flow:
   * 1. Trigger native Google sign-in UI
   * 2. Retrieve idToken from sign-in result and accessToken via getTokens()
   * 3. Send both to backend POST /api/social-login/
   * 4. Backend validates id_token, fetches user info via People API with access_token
   * 5. Returns DRF auth token
   */
  const handleGoogleSignIn = useCallback(async () => {
    if (loading) return;
    setLoading(true);

    try {
      if (!googleWebClientId) {
        Alert.alert('Not Available', 'Google Sign-In is not configured. Please contact support.');
        return;
      }

      // Check for Google Play Services (Android)
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      // Trigger the native Google sign-in UI
      const response = await GoogleSignin.signIn();

      const idToken = response.data?.idToken;
      if (!idToken) {
        throw new Error('No ID token received from Google');
      }

      // Get the access token (needed for backend People API calls)
      const tokens = await GoogleSignin.getTokens();
      const accessToken = tokens.accessToken;

      if (!accessToken) {
        throw new Error('No access token received from Google');
      }

      // Send tokens to backend
      await authApi.socialLogin({
        provider: 'google',
        id_token: idToken,
        access_token: accessToken,
      });

      // Update auth state - triggers navigation via AuthContext
      signIn();
    } catch (error: unknown) {
      if (isErrorWithCode(error)) {
        switch (error.code) {
          case statusCodes.SIGN_IN_CANCELLED:
            // User cancelled, no alert needed
            break;
          case statusCodes.IN_PROGRESS:
            // Sign-in already in progress
            break;
          case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
            Alert.alert(
              'Google Play Services',
              'Google Play Services is not available on this device.',
            );
            break;
          default:
            console.error('Google Sign-In error:', error);
            Alert.alert('Sign In Failed', 'Failed to sign in with Google. Please try again.');
        }
      } else {
        console.error('Google Sign-In error:', error);
        const message =
          error instanceof Error ? error.message : 'Failed to sign in with Google. Please try again.';
        Alert.alert('Sign In Failed', message);
      }
    } finally {
      setLoading(false);
    }
  }, [loading, signIn]);

  /**
   * Apple Sign-In flow (iOS only):
   * 1. Trigger native Apple sign-in dialog
   * 2. Extract identityToken (JWT) from credential
   * 3. Send as id_token to backend POST /api/social-login/
   * 4. Backend decodes JWT, extracts email/name, creates/finds user
   * 5. Returns DRF auth token
   *
   * Note: Apple only provides user name/email on the FIRST sign-in.
   * Subsequent sign-ins only return the identityToken with sub/email.
   */
  const handleAppleSignIn = useCallback(async () => {
    if (loading) return;

    if (Platform.OS !== 'ios') {
      Alert.alert('Not Available', 'Apple Sign In is only available on iOS devices.');
      return;
    }

    if (!appleAuthAvailable) {
      Alert.alert('Not Available', 'Apple Sign In is not available on this device.');
      return;
    }

    setLoading(true);

    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const identityToken = credential.identityToken;
      if (!identityToken) {
        throw new Error('No identity token received from Apple');
      }

      // Send identity token (JWT) to backend
      await authApi.socialLogin({
        provider: 'apple',
        id_token: identityToken,
      });

      // Update auth state - triggers navigation via AuthContext
      signIn();
    } catch (error: unknown) {
      const appleError = error as { code?: string };
      if (appleError.code === 'ERR_REQUEST_CANCELED') {
        // User cancelled, no alert needed
        return;
      }

      console.error('Apple Sign-In error:', error);
      const message =
        error instanceof Error ? error.message : 'Failed to sign in with Apple. Please try again.';
      Alert.alert('Sign In Failed', message);
    } finally {
      setLoading(false);
    }
  }, [loading, appleAuthAvailable, signIn]);

  return {
    handleGoogleSignIn,
    handleAppleSignIn,
    loading,
    appleAuthAvailable,
  };
}
