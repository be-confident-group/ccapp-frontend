/**
 * Local (on-device) block list for community content.
 *
 * This filters a blocked author's posts and comments out of the current
 * device only — it is not yet enforced server-side. TODO(backend): move
 * enforcement to the API so a block also applies across the user's other
 * devices and prevents the blocked user's content from being served at all,
 * per App Store Guideline 1.2.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@radzi_blocked_user_ids';

async function readIds(): Promise<number[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'number') : [];
  } catch (error) {
    console.error('[blockedUsers] Failed to read block list:', error);
    return [];
  }
}

async function writeIds(ids: number[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export async function getBlockedUserIds(): Promise<number[]> {
  return readIds();
}

export async function blockUserId(userId: number): Promise<number[]> {
  const ids = await readIds();
  if (ids.includes(userId)) return ids;
  const updated = [...ids, userId];
  await writeIds(updated);
  return updated;
}
