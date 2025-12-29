import { apiClient } from './client';

export interface LeaderboardEntry {
  user_id: string;
  rank: number;
  first_name: string;
  last_name: string;
  profile_picture?: string;
  value: number; // distance in km OR trip count
  gender?: 'M' | 'F' | 'O' | '';
  joined_at?: string; // ISO date string
}

export interface LeaderboardResponse {
  category: string;
  month?: string; // "2025-12" or null for all time
  group_id?: string | null;
  entries: LeaderboardEntry[];
}

export type ActivityType = 'walks' | 'rides';
export type SortBy = 'distance' | 'trips';
export type GenderFilter = 'all' | 'male' | 'female';

export interface LeaderboardParams {
  activity_type: ActivityType;
  sort_by: SortBy;
  gender_filter?: GenderFilter;
  month?: string | null; // "2025-12" or null for all time
  group_id?: string | null;
  limit?: number; // Default 20
}

class LeaderboardApi {
  /**
   * Fetch leaderboard data from the backend
   */
  async getLeaderboard(params: LeaderboardParams): Promise<LeaderboardResponse> {
    const queryParams = new URLSearchParams();

    queryParams.append('activity_type', params.activity_type);
    queryParams.append('sort_by', params.sort_by);

    if (params.gender_filter && params.gender_filter !== 'all') {
      queryParams.append('gender', params.gender_filter);
    }

    if (params.month) {
      queryParams.append('month', params.month);
    }

    if (params.group_id) {
      queryParams.append('group_id', params.group_id);
    }

    queryParams.append('limit', String(params.limit || 20));

    const response = await apiClient.get(`/leaderboards/?${queryParams.toString()}`);
    return response.data;
  }
}

export const leaderboardApi = new LeaderboardApi();
