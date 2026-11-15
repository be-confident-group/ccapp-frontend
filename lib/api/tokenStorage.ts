import * as SecureStore from 'expo-secure-store';

// iOS wakes the app in the background (location updates, push) while the phone
// is locked. The keychain default, "when unlocked", made the token unreadable
// there; the request then went out unauthenticated and the resulting 401 signed
// the user out. The token now lives under a new key that is readable any time
// after the first unlock. (Re-saving under the old key would keep its old
// accessibility: expo-secure-store only updates the value of an existing item.)
const AUTH_TOKEN_KEY = 'authToken.v2';
const LEGACY_AUTH_TOKEN_KEY = 'authToken';
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

/**
 * Secure storage could not be read right now (e.g. device locked). This is
 * NOT the same as being signed out: callers must not clear the session on it.
 */
export class TokenUnavailableError extends Error {
  constructor(cause: unknown) {
    super(`Auth token storage unavailable: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = 'TokenUnavailableError';
  }
}

/** Returns the stored token, or null when signed out. Throws TokenUnavailableError if storage is unreadable. */
export async function readAuthToken(): Promise<string | null> {
  try {
    const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY, OPTIONS);
    if (token) return token;

    // One-time move of a token saved by an older build.
    const legacy = await SecureStore.getItemAsync(LEGACY_AUTH_TOKEN_KEY);
    if (!legacy) return null;
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, legacy, OPTIONS);
    await SecureStore.deleteItemAsync(LEGACY_AUTH_TOKEN_KEY);
    return legacy;
  } catch (error) {
    console.error('Error getting auth token:', error);
    throw new TokenUnavailableError(error);
  }
}

export async function saveAuthToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token, OPTIONS);
  await SecureStore.deleteItemAsync(LEGACY_AUTH_TOKEN_KEY).catch(() => {});
}

export async function deleteAuthToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY, OPTIONS);
    await SecureStore.deleteItemAsync(LEGACY_AUTH_TOKEN_KEY);
  } catch (error) {
    console.error('Error deleting auth token:', error);
  }
}
