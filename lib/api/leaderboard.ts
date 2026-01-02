import { apiClient } from './client';

/**
 * Backend response for a single leaderboard entry
 */
export interface BackendLeaderboardEntry {
  id: number;
  name: string;
  last_name: string;
  profile_picture?: string | null;
  value: number; // distance in km OR trip count
}

/**
 * Backend response for a single leaderboard (paginated)
 */
export interface BackendLeaderboardResponse {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results: BackendLeaderboardEntry[];
}

/**
 * Backend response when fetching all leaderboards
 */
export interface BackendAllLeaderboardsItem {
  name: string; // e.g., "top_riders_distance"
  user_rank: number | null;
  results: BackendLeaderboardEntry[];
}

export type BackendAllLeaderboardsResponse = BackendAllLeaderboardsItem[];

/**
 * Leaderboard type mapping
 */
export type LeaderboardType =
  | 'top_riders_distance'
  | 'top_riders_count'
  | 'top_walkers_distance'
  | 'top_walkers_count';

export interface LeaderboardParams {
  leaderboard_type: LeaderboardType;
  club_id?: number | null;
  gender?: 'M' | 'F' | 'O' | 'P' | null;
}

class LeaderboardApi {
  /**
   * Fetch a specific leaderboard from the backend
   */
  async getLeaderboard(params: LeaderboardParams): Promise<BackendLeaderboardResponse> {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('leaderboard_type', params.leaderboard_type);

      if (params.club_id) {
        queryParams.append('club_id', params.club_id.toString());
      }

      if (params.gender) {
        queryParams.append('gender', params.gender);
      }

      return await apiClient.get<BackendLeaderboardResponse>(
        `/api/leaderboards/?${queryParams.toString()}`
      );
    } catch (error) {
      console.error('[LeaderboardAPI] Error fetching leaderboard:', error);
      throw error;
    }
  }

  /**
   * Fetch all leaderboards at once
   */
  async getAllLeaderboards(club_id?: number | null): Promise<BackendAllLeaderboardsResponse> {
    try {
      const queryParams = new URLSearchParams();

      if (club_id) {
        queryParams.append('club_id', club_id.toString());
      }

      const endpoint = queryParams.toString()
        ? `/api/leaderboards/?${queryParams.toString()}`
        : '/api/leaderboards/';

      return await apiClient.get<BackendAllLeaderboardsResponse>(endpoint);
    } catch (error) {
      console.error('[LeaderboardAPI] Error fetching all leaderboards:', error);
      throw error;
    }
  }

  /**
   * Helper to determine leaderboard type from activity and sort
   */
  getLeaderboardType(activity: 'rides' | 'walks', sortBy: 'distance' | 'trips'): LeaderboardType {
    if (activity === 'rides') {
      return sortBy === 'distance' ? 'top_riders_distance' : 'top_riders_count';
    } else {
      return sortBy === 'distance' ? 'top_walkers_distance' : 'top_walkers_count';
    }
  }
}

export const leaderboardApi = new LeaderboardApi();
