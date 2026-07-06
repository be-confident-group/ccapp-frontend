/**
 * App environment configuration
 * Centralises all environment variables and platform-specific IDs.
 */

// ---------------------------------------------------------------------------
// Store IDs
// ---------------------------------------------------------------------------

/**
 * Apple App Store numeric ID (the `id` portion of the App Store URL).
 * Replace PLACEHOLDER_IOS_APP_ID with the real value before shipping.
 */
export const IOS_APP_STORE_ID = process.env.EXPO_PUBLIC_IOS_APP_STORE_ID ?? 'PLACEHOLDER_IOS_APP_ID';

/**
 * Android package name used in the Play Store URL.
 * Replace PLACEHOLDER_ANDROID_PACKAGE with the real value before shipping.
 */
export const ANDROID_PACKAGE_NAME = process.env.EXPO_PUBLIC_ANDROID_PACKAGE ?? 'PLACEHOLDER_ANDROID_PACKAGE';

// ---------------------------------------------------------------------------
// Legal
// ---------------------------------------------------------------------------

export const PRIVACY_POLICY_URL = 'https://www.radzi.com/privacy';

/** TODO: set once Radzi publishes a Terms of Service page. */
export const TERMS_OF_SERVICE_URL: string | null = null;

// ---------------------------------------------------------------------------
// Dev-time warnings for placeholder values
// ---------------------------------------------------------------------------
if (__DEV__) {
  if (IOS_APP_STORE_ID === 'PLACEHOLDER_IOS_APP_ID') {
    console.warn(
      '[config/env] IOS_APP_STORE_ID is not set. ' +
        'Set EXPO_PUBLIC_IOS_APP_STORE_ID in your .env file.'
    );
  }
  if (ANDROID_PACKAGE_NAME === 'PLACEHOLDER_ANDROID_PACKAGE') {
    console.warn(
      '[config/env] ANDROID_PACKAGE_NAME is not set. ' +
        'Set EXPO_PUBLIC_ANDROID_PACKAGE in your .env file.'
    );
  }
}
