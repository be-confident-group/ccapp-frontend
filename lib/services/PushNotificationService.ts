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
const EAS_PROJECT_ID = '377c486d-066c-4fa6-a11f-98195f1b848e';

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
   * Call after a successful login / session restore.
   * Requests notification permission, retrieves the Expo push token, and
   * registers it with the backend (skipping if unchanged).
   */
  async registerForUser(): Promise<void> {
    try {
      const token = await getOrRequestToken();
      if (!token) return;

      const cached = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
      if (cached === token) {
        // Token unchanged — skip re-registration
        return;
      }

      await registerPushToken(token);
      await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
      console.log('[Push] Registered push token with backend');
    } catch (err) {
      // Non-fatal: push notifications are a nice-to-have
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
      await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
      console.log('[Push] Unregistered push token');
    } catch (err) {
      console.warn('[Push] unregister failed:', err);
    }
  },
};

export default PushNotificationService;
