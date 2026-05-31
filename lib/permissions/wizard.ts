import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { PermissionsAndroid, Platform, Linking } from 'react-native';
import { Pedometer } from 'expo-sensors';

export type PermissionResult = {
  status: 'granted' | 'denied' | 'undetermined' | 'opened-settings';
};

export async function requestLocationForeground(): Promise<PermissionResult> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return { status: status === 'granted' ? 'granted' : 'denied' };
}

export async function requestLocationBackground(): Promise<PermissionResult> {
  if (Platform.OS === 'android') {
    const { status: fgStatus } = await Location.getForegroundPermissionsAsync();
    if (fgStatus !== 'granted') {
      return { status: 'undetermined' };
    }
    // Android 11+ requires the user to grant background location from Settings
    await Linking.openSettings();
    return { status: 'opened-settings' };
  }

  // iOS
  const { status } = await Location.requestBackgroundPermissionsAsync();
  return { status: status === 'granted' ? 'granted' : 'denied' };
}

export async function requestMotion(): Promise<PermissionResult> {
  if (Platform.OS === 'android') {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
      {
        title: 'Motion & Activity',
        message: 'Radzi needs this to detect when you start walking or cycling.',
        buttonPositive: 'Allow',
        buttonNegative: 'Skip',
      },
    );
    if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
      // User selected "Don't ask again" — must open app settings to re-enable
      await Linking.openSettings();
      return { status: 'opened-settings' };
    }
    return {
      status: result === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied',
    };
  }

  // iOS
  const { status } = await Pedometer.requestPermissionsAsync();
  return { status: status === 'granted' ? 'granted' : 'denied' };
}

export async function requestNotifications(): Promise<PermissionResult> {
  const result = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: true },
  });
  return { status: result.granted ? 'granted' : 'denied' };
}

export async function checkAll(): Promise<Record<string, PermissionResult['status']>> {
  const [fgLocation, bgLocation, notifs] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync(),
    Notifications.getPermissionsAsync(),
  ]);

  let motionStatus: PermissionResult['status'];
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
    );
    motionStatus = granted ? 'granted' : 'denied';
  } else {
    const { status } = await Pedometer.getPermissionsAsync();
    motionStatus = status === 'granted' ? 'granted' : status === 'undetermined' ? 'undetermined' : 'denied';
  }

  const mapStatus = (s: string): PermissionResult['status'] => {
    if (s === 'granted') return 'granted';
    if (s === 'undetermined') return 'undetermined';
    return 'denied';
  };

  return {
    locationForeground: mapStatus(fgLocation.status),
    locationBackground: mapStatus(bgLocation.status),
    motion: motionStatus,
    notifications: notifs.granted ? 'granted' : notifs.status === 'undetermined' ? 'undetermined' : 'denied',
  };
}

export function openAppSettings(): void {
  Linking.openSettings();
}
