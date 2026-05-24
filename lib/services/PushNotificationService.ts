/**
 * PushNotificationService
 *
 * Manages Expo push token lifecycle:
 *   - On login: request permissions, get token, register with backend.
 *   - On logout: DELETE the token from the backend so the device stops receiving pushes.
 *
 * Token is cached in AsyncStorage under PUSH_TOKEN_KEY so we don't re-register
 * on every app launch if the token hasn't changed.
 */

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { registerPushToken, deletePushToken } from '@/lib/api/notifications';

const PUSH_TOKEN_KEY = '@push_token';
const PUSH_REGISTRATION_SUCCESS_KEY = '@radzi/push_registration_success';
const EAS_PROJECT_ID = '377c486d-066c-4fa6-a11f-98195f1b848e';

const RETRY_DELAYS_MS = [1000, 4000, 16000];

async function getOrRequestToken(): Promise<string | null> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Push] Permission not granted');
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID });
    return tokenData.data;
  } catch (err) {
    console.warn('[Push] Failed to get push token:', err);
    return null;
  }
}

const PushNotificationService = {
  /**
   * Current registration status. Starts as 'pending', becomes 'registered'
   * on success or 'failed' after all retry attempts are exhausted.
   */
  registrationStatus: 'pending' as 'pending' | 'registered' | 'failed',

  /**
   * Call after a successful login / session restore.
   * Requests notification permission, retrieves the Expo push token, and
   * registers it with the backend (skipping if unchanged).
   * Retries the backend call up to 3 times with exponential backoff (1s / 4s / 16s).
   */
  async registerForUser(): Promise<void> {
    this.registrationStatus = 'pending';
    try {
      const token = await getOrRequestToken();
      if (!token) return;

      const [cachedToken, cachedSuccess] = await AsyncStorage.multiGet([
        PUSH_TOKEN_KEY,
        PUSH_REGISTRATION_SUCCESS_KEY,
      ]);
      const storedToken = cachedToken[1];
      const registrationSucceeded = cachedSuccess[1];

      if (storedToken === token && registrationSucceeded === 'true') {
        // Token unchanged and last registration succeeded — skip re-registration
        this.registrationStatus = 'registered';
        return;
      }

      let lastError: unknown;
      for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
        try {
          await registerPushToken(token);
          await AsyncStorage.multiSet([
            [PUSH_TOKEN_KEY, token],
            [PUSH_REGISTRATION_SUCCESS_KEY, 'true'],
          ]);
          this.registrationStatus = 'registered';
          console.log('[Push] Registered push token with backend');
          return;
        } catch (err) {
          lastError = err;
          if (attempt < RETRY_DELAYS_MS.length - 1) {
            const delay = RETRY_DELAYS_MS[attempt];
            console.warn(`[Push] Registration attempt ${attempt + 1} failed, retrying in ${delay}ms:`, err);
            await new Promise<void>((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      // All retries exhausted
      this.registrationStatus = 'failed';
      console.warn('[Push] registerForUser failed after all retries:', lastError);
    } catch (err) {
      // Non-fatal: push notifications are a nice-to-have
      this.registrationStatus = 'failed';
      console.warn('[Push] registerForUser failed:', err);
    }
  },

  /**
   * Call when the user logs out.
   * Removes the token from the backend so the device stops receiving pushes.
   */
  async unregister(): Promise<void> {
    try {
      const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
      if (!token) return;

      await deletePushToken(token);
      await AsyncStorage.multiRemove([PUSH_TOKEN_KEY, PUSH_REGISTRATION_SUCCESS_KEY]);
      console.log('[Push] Unregistered push token');
    } catch (err) {
      console.warn('[Push] unregister failed:', err);
    }
  },
};

export default PushNotificationService;
