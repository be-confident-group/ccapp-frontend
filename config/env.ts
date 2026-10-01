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
 * Defaults to android.package from app.config.js.
 */
export const ANDROID_PACKAGE_NAME = process.env.EXPO_PUBLIC_ANDROID_PACKAGE ?? 'com.radzi.app';

// ---------------------------------------------------------------------------
// Legal
// ---------------------------------------------------------------------------

export const PRIVACY_POLICY_URL = 'https://www.radzi.com/privacy';

export const TERMS_OF_SERVICE_URL = 'https://www.radzi.com/terms';

// ---------------------------------------------------------------------------
// Support
// ---------------------------------------------------------------------------

/**
 * Published contact address for support requests and content reports
 * (App Store Guideline 1.2 requires this to be reachable in-app).
 * Confirm this inbox exists and is monitored before shipping.
 */
export const SUPPORT_EMAIL = 'support@radzi.com';

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
}
