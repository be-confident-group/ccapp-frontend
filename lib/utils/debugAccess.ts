export const DEBUG_USER_EMAILS = ['a.lotfipoor@gmail.com'];

export function isDebugUser(email?: string | null): boolean {
  return !!email && DEBUG_USER_EMAILS.includes(email.trim().toLowerCase());
}

/**
 * Returns true when developer/diagnostics UI should be visible.
 * Always on in __DEV__ and non-production EAS builds.
 * Also on in production for accounts listed in DEBUG_USER_EMAILS.
 */
export function isDebugEnabled(email?: string | null): boolean {
  // __DEV__ is a React Native global — undefined in node/jest test environment.
  const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
  return (
    isDev ||
    process.env.EXPO_PUBLIC_BUILD_PROFILE !== 'production' ||
    isDebugUser(email)
  );
}
