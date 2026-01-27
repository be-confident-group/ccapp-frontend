/**
 * React Query hooks for Leaderboard API operations
 */

import { useQuery } from '@tanstack/react-query';
import { leaderboardApi, type LeaderboardType } from '@/lib/api/leaderboard';

/**
 * Query key factory for leaderboards
 */
export const leaderboardKeys = {
  all: ['leaderboards'] as const,
  lists: () => [...leaderboardKeys.all, 'list'] as const,
  list: (type: LeaderboardType, clubId?: number | null, gender?: 'M' | 'F' | 'O' | 'P' | null, startDate?: string | null, endDate?: string | null) =>
    [...leaderboardKeys.lists(), type, clubId, gender, startDate, endDate] as const,
  allBoards: (clubId?: number | null) => [...leaderboardKeys.all, 'all', clubId] as const,
};

/**
 * Hook to fetch a specific leaderboard
 */
export function useLeaderboard(
  type: LeaderboardType,
  clubId?: number | null,
  gender?: 'M' | 'F' | 'O' | 'P' | null,
  startDate?: string | null,
  endDate?: string | null
) {
  return useQuery({
    queryKey: leaderboardKeys.list(type, clubId, gender, startDate, endDate),
    queryFn: () =>
      leaderboardApi.getLeaderboard({
        leaderboard_type: type,
        club_id: clubId,
        gender: gender,
        start_date: startDate,
        end_date: endDate,
      }),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to fetch all leaderboards at once
 */
export function useAllLeaderboards(clubId?: number | null) {
  return useQuery({
    queryKey: leaderboardKeys.allBoards(clubId),
    queryFn: () => leaderboardApi.getAllLeaderboards(clubId),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
