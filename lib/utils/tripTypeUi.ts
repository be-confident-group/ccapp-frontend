/**
 * UI filter for the 4-class ML taxonomy.
 *
 * The on-device ML classifier and backend both speak the full 4-class set:
 *   walk | run | cycle | drive
 *
 * In v1 the product surface only wants to show walking and cycling. Running
 * and vehicle/transport trips are still stored, synced, and available for
 * future analyses/model retraining — they're just hidden in the UI.
 *
 * Always funnel a list/stats/chart through `filterVisibleTrips` or the
 * `VISIBLE_TRIP_TYPES` constant before rendering so v1 stays consistent.
 * Bumping the whitelist in one place is how we later "enable" running +
 * transport trips in the UI.
 */

import type { TripType } from '@/types/trip';

export const VISIBLE_TRIP_TYPES: readonly TripType[] = ['walk', 'cycle'] as const;

export function isVisibleTripType(type: TripType | null | undefined): boolean {
  if (!type) return false;
  return (VISIBLE_TRIP_TYPES as readonly string[]).includes(type);
}

export function filterVisibleTrips<T extends { type?: TripType | null }>(trips: T[]): T[] {
  return trips.filter((t) => isVisibleTripType(t.type ?? null));
}

/**
 * Trophy categories we still surface. Running/drive trophies are suppressed
 * in v1 (same rationale as trip lists).
 */
export const VISIBLE_TROPHY_CATEGORIES: readonly string[] = ['walk', 'cycle', 'distance', 'streak'];

export function isVisibleTrophyCategory(category: string | null | undefined): boolean {
  if (!category) return true; // category-less trophies always visible
  const lower = category.toLowerCase();
  if (lower === 'run' || lower === 'running' || lower === 'drive' || lower === 'transport') {
    return false;
  }
  return true;
}
