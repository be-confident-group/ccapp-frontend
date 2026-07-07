/**
 * Returns true when developer/diagnostics UI should be visible.
 * Only on in __DEV__ and non-production EAS builds — never in production,
 * regardless of account, so App Review never sees developer tooling.
 */
export function isDebugEnabled(): boolean {
  // __DEV__ is a React Native global — undefined in node/jest test environment.
  const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
  return isDev || process.env.EXPO_PUBLIC_BUILD_PROFILE !== 'production';
}
