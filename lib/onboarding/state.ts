import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Local (AsyncStorage) state management for the onboarding flow.
 * Backend-backed fields (display name, avatar) are handled separately via authApi.
 * This module manages local preferences and goals that the backend has no field for.
 */

// ============================================================================
// Types
// ============================================================================

export type LocalPreferences = {
  defaultMode: 'walk' | 'cycle';
};

export type Goals = {
  weeklyDistanceKm: number;
  activeDaysPerWeek: number;
};

// ============================================================================
// Constants
// ============================================================================

const ONBOARDING_KEY = (uid: string | number) => `@radzi/onboarding_completed:${uid}`;
const PREFS_KEY = (uid: string | number) => `@radzi/onboarding_prefs:${uid}`;
const GOALS_KEY = (uid: string | number) => `@radzi/onboarding_goals:${uid}`;
const SKIPPED_PERMS_KEY = (uid: string | number) => `@radzi/onboarding_skipped_perms:${uid}`;
const PERM_STEP_KEY = (uid: string | number) => `@radzi/onboarding_perm_step:${uid}`;

export const MIGRATION_FLAG = '@radzi/onboarding_migrated_v1';

// ============================================================================
// Onboarding Completion Flag
// ============================================================================

/**
 * Check if onboarding is complete for a given user.
 * @param uid User ID (string or number)
 * @returns true if onboarding is marked complete, false otherwise
 */
export async function isOnboardingComplete(uid: string | number): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(ONBOARDING_KEY(uid));
    return value === '1';
  } catch (error) {
    console.warn(`[onboarding/state] Error reading onboarding completion for uid ${uid}:`, error);
    return false;
  }
}

/**
 * Mark onboarding as complete for a given user.
 * @param uid User ID (string or number)
 */
export async function markOnboardingComplete(uid: string | number): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_KEY(uid), '1');
  } catch (error) {
    console.warn(`[onboarding/state] Error marking onboarding complete for uid ${uid}:`, error);
  }
}

// ============================================================================
// Local Preferences (defaultMode — no backend field)
// ============================================================================

/**
 * Save local preferences for a given user.
 * @param uid User ID (string or number)
 * @param prefs Local preferences object
 */
export async function saveLocalPreferences(
  uid: string | number,
  prefs: LocalPreferences
): Promise<void> {
  try {
    const json = JSON.stringify(prefs);
    await AsyncStorage.setItem(PREFS_KEY(uid), json);
  } catch (error) {
    console.warn(`[onboarding/state] Error saving local preferences for uid ${uid}:`, error);
  }
}

/**
 * Get local preferences for a given user.
 * @param uid User ID (string or number)
 * @returns Local preferences object, or null if not found
 */
export async function getLocalPreferences(uid: string | number): Promise<LocalPreferences | null> {
  try {
    const json = await AsyncStorage.getItem(PREFS_KEY(uid));
    if (!json) return null;
    return JSON.parse(json) as LocalPreferences;
  } catch (error) {
    console.warn(`[onboarding/state] Error reading local preferences for uid ${uid}:`, error);
    return null;
  }
}

// ============================================================================
// Goals (weeklyDistanceKm, activeDaysPerWeek)
// ============================================================================

/**
 * Save goals for a given user.
 * @param uid User ID (string or number)
 * @param goals Goals object
 */
export async function saveGoals(uid: string | number, goals: Goals): Promise<void> {
  try {
    const json = JSON.stringify(goals);
    await AsyncStorage.setItem(GOALS_KEY(uid), json);
  } catch (error) {
    console.warn(`[onboarding/state] Error saving goals for uid ${uid}:`, error);
  }
}

/**
 * Get goals for a given user.
 * @param uid User ID (string or number)
 * @returns Goals object, or null if not found
 */
export async function getGoals(uid: string | number): Promise<Goals | null> {
  try {
    const json = await AsyncStorage.getItem(GOALS_KEY(uid));
    if (!json) return null;
    return JSON.parse(json) as Goals;
  } catch (error) {
    console.warn(`[onboarding/state] Error reading goals for uid ${uid}:`, error);
    return null;
  }
}

// ============================================================================
// Permission Wizard Step (resume after app kill / Settings navigation)
// ============================================================================

export async function savePermStep(uid: string | number, step: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PERM_STEP_KEY(uid), step);
  } catch (error) {
    console.warn(`[onboarding/state] Error saving perm step for uid ${uid}:`, error);
  }
}

export async function getPermStep(uid: string | number): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PERM_STEP_KEY(uid));
  } catch (error) {
    console.warn(`[onboarding/state] Error reading perm step for uid ${uid}:`, error);
    return null;
  }
}

export async function clearPermStep(uid: string | number): Promise<void> {
  try {
    await AsyncStorage.removeItem(PERM_STEP_KEY(uid));
  } catch (error) {
    console.warn(`[onboarding/state] Error clearing perm step for uid ${uid}:`, error);
  }
}

// ============================================================================
// Skipped Permissions Tracking (for permission banner)
// ============================================================================

/**
 * Get list of permissions that the user has skipped.
 * @param uid User ID (string or number)
 * @returns Array of skipped permission strings, or empty array if none
 */
export async function getSkippedPermissions(uid: string | number): Promise<string[]> {
  try {
    const json = await AsyncStorage.getItem(SKIPPED_PERMS_KEY(uid));
    if (!json) return [];
    return JSON.parse(json) as string[];
  } catch (error) {
    console.warn(`[onboarding/state] Error reading skipped permissions for uid ${uid}:`, error);
    return [];
  }
}

/**
 * Mark a permission as skipped by the user.
 * @param uid User ID (string or number)
 * @param permission Permission string to mark as skipped
 */
export async function markPermissionSkipped(
  uid: string | number,
  permission: string
): Promise<void> {
  try {
    const existing = await getSkippedPermissions(uid);
    if (!existing.includes(permission)) {
      existing.push(permission);
      const json = JSON.stringify(existing);
      await AsyncStorage.setItem(SKIPPED_PERMS_KEY(uid), json);
    }
  } catch (error) {
    console.warn(
      `[onboarding/state] Error marking permission skipped for uid ${uid}:`,
      error
    );
  }
}
