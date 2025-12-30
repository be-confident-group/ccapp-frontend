/**
 * Trophy API service for backend integration
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from './client';

/**
 * Trophy type from backend
 */
export type TrophyType = 'trip_count' | 'distance' | 'streak' | 'speed' | 'co2_saved';
export type TripTypeFilter = 'all' | 'bike' | 'walk';

/**
 * Trophy interface matching backend response
 */
export interface Trophy {
  name: string;
  description: string;
  code: string; // Unique trophy code (e.g., "first-bike-ride")
  trophy_type: TrophyType;
  trip_type: TripTypeFilter;
  threshold: number;
  valid_from: string | null; // ISO date
  valid_until: string | null; // ISO date
  trips_date_from: string | null; // ISO date
  trips_date_to: string | null; // ISO date
  progress: number; // Percentage (0-100)
  is_earned: boolean;
}

/**
 * Week day activity data
 */
export interface WeekDay {
  day: string;
  date: string;
  has_activity: boolean;
  is_today?: boolean;
}

/**
 * Streak data with current streak and week activity
 */
export interface StreakData {
  current: number;
  week_days: WeekDay[];
}

/**
 * User profile response with stats
 */
export interface UserProfile {
  name: string;
  last_name: string;
  email: string;
  date_of_birth: string;
  gender: string;
  profile_picture: string | null;
  stats: {
    total_distance_ride: number;
    total_rides: number;
    total_distance_walk: number;
    total_walks: number;
    co2_saved: number;
  };
  streak: StreakData;
  trophies: Trophy[];
  records?: {
    longest_distance_walk: number | null;
    longest_distance_ride: number | null;
    longest_duration_walk: number;
    longest_duration_ride: number;
    most_trips_day: number | null;
    most_trips_week: number | null;
    most_trips_month: number | null;
    longest_streak: number | null;
  };
}

const TROPHY_CACHE_KEY = '@radzi_cached_trophies';

/**
 * Trophy API service
 */
class TrophyAPI {
  private cachedTrophies: Trophy[] | null = null;

  /**
   * Fetch all trophies for the current user
   */
  async getTrophies(): Promise<Trophy[]> {
    try {
      const trophies = await apiClient.get<Trophy[]>('/api/trophies/');

      // Update cache
      await this.cacheTrophies(trophies);
      this.cachedTrophies = trophies;

      return trophies;
    } catch (error) {
      console.error('[TrophyAPI] Error fetching trophies:', error);
      throw error;
    }
  }

  /**
   * Get user profile with trophy data
   */
  async getUserProfile(): Promise<UserProfile> {
    try {
      const profile = await apiClient.get<UserProfile>('/api/profile/');

      // Update trophy cache with profile trophies
      if (profile.trophies) {
        await this.cacheTrophies(profile.trophies);
        this.cachedTrophies = profile.trophies;
      }

      return profile;
    } catch (error) {
      console.error('[TrophyAPI] Error fetching user profile:', error);
      throw error;
    }
  }

  /**
   * Get newly earned trophies by comparing with cached list
   * Returns trophies that are now earned but weren't in the cache
   */
  async getNewTrophies(): Promise<Trophy[]> {
    try {
      // Get current trophies from backend
      const currentTrophies = await this.getTrophies();

      // Get cached trophies
      const cachedTrophies = await this.getCachedTrophies();

      if (!cachedTrophies || cachedTrophies.length === 0) {
        console.log('[TrophyAPI] No cached trophies, all earned trophies are new');
        return currentTrophies.filter(t => t.is_earned);
      }

      // Find trophies that are earned now but weren't before
      const cachedEarnedCodes = new Set(
        cachedTrophies.filter(t => t.is_earned).map(t => t.code)
      );

      const newTrophies = currentTrophies.filter(
        t => t.is_earned && !cachedEarnedCodes.has(t.code)
      );

      if (newTrophies.length > 0) {
        console.log(
          `[TrophyAPI] Found ${newTrophies.length} newly earned trophies:`,
          newTrophies.map(t => t.name)
        );
      }

      return newTrophies;
    } catch (error) {
      console.error('[TrophyAPI] Error getting new trophies:', error);
      return [];
    }
  }

  /**
   * Get earned trophies
   */
  getEarnedTrophies(trophies: Trophy[]): Trophy[] {
    return trophies.filter(t => t.is_earned);
  }

  /**
   * Get in-progress trophies (not earned but have progress)
   */
  getInProgressTrophies(trophies: Trophy[]): Trophy[] {
    return trophies.filter(t => !t.is_earned && t.progress > 0);
  }

  /**
   * Get locked trophies (no progress yet)
   */
  getLockedTrophies(trophies: Trophy[]): Trophy[] {
    return trophies.filter(t => !t.is_earned && t.progress === 0);
  }

  /**
   * Cache trophies to AsyncStorage
   */
  private async cacheTrophies(trophies: Trophy[]): Promise<void> {
    try {
      await AsyncStorage.setItem(TROPHY_CACHE_KEY, JSON.stringify(trophies));
    } catch (error) {
      console.error('[TrophyAPI] Error caching trophies:', error);
    }
  }

  /**
   * Get cached trophies from AsyncStorage
   */
  async getCachedTrophies(): Promise<Trophy[] | null> {
    if (this.cachedTrophies) {
      return this.cachedTrophies;
    }

    try {
      const cached = await AsyncStorage.getItem(TROPHY_CACHE_KEY);
      if (cached) {
        this.cachedTrophies = JSON.parse(cached);
        return this.cachedTrophies;
      }
      return null;
    } catch (error) {
      console.error('[TrophyAPI] Error reading cached trophies:', error);
      return null;
    }
  }

  /**
   * Clear trophy cache
   */
  async clearCache(): Promise<void> {
    try {
      this.cachedTrophies = null;
      await AsyncStorage.removeItem(TROPHY_CACHE_KEY);
      console.log('[TrophyAPI] Cache cleared');
    } catch (error) {
      console.error('[TrophyAPI] Error clearing cache:', error);
    }
  }

  /**
   * Get trophy icon/emoji based on trophy type
   */
  getTrophyIcon(trophy: Trophy): string {
    // Map trophy codes to emojis
    const iconMap: Record<string, string> = {
      'first-bike-ride': '🚴',
      'first-walk': '🚶',
      'week-warrior': '🔥',
      'century': '💯',
      'eco-champion': '🌍',
      'speed-demon': '⚡',
    };

    if (iconMap[trophy.code]) {
      return iconMap[trophy.code];
    }

    // Fallback based on trophy type
    const typeIcons: Record<TrophyType, string> = {
      trip_count: '🏆',
      distance: '📏',
      streak: '🔥',
      speed: '⚡',
      co2_saved: '🌍',
    };

    return typeIcons[trophy.trophy_type] || '🏅';
  }

  /**
   * Check if a trophy was recently earned (within 24 hours)
   */
  isRecentlyEarned(trophy: Trophy, currentTrophies: Trophy[]): boolean {
    // Since backend doesn't return earned_at timestamp,
    // we can only check if it's newly earned by comparing with cache
    // This would need to be called after comparing with cached list
    return false; // Placeholder - would need backend support for earned_at
  }
}

export const trophyAPI = new TrophyAPI();
