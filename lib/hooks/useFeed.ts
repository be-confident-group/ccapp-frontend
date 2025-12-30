/**
 * React Query hooks for Feed API operations
 */

import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { feedAPI } from '@/lib/api/feed';
import type { FeedResponse } from '@/types/feed';

/**
 * Query key factory for feed
 */
export const feedKeys = {
  all: ['feed'] as const,
  lists: () => [...feedKeys.all, 'list'] as const,
  list: (page?: number) => [...feedKeys.lists(), { page }] as const,
};

/**
 * Hook to fetch feed (single page)
 */
export function useFeed(page: number = 1, pageSize: number = 20) {
  return useQuery({
    queryKey: feedKeys.list(page),
    queryFn: () => feedAPI.getFeed(page, pageSize),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Hook to fetch feed with infinite scroll
 */
export function useInfiniteFeed(pageSize: number = 20) {
  return useInfiniteQuery({
    queryKey: feedKeys.lists(),
    queryFn: ({ pageParam = 1 }) => feedAPI.getFeed(pageParam, pageSize),
    getNextPageParam: (lastPage, allPages) => {
      // If there's a next page URL, return the next page number
      if (lastPage.next) {
        return allPages.length + 1;
      }
      return undefined;
    },
    getPreviousPageParam: (firstPage, allPages) => {
      // If there's a previous page URL, return the previous page number
      if (firstPage.previous) {
        return allPages.length > 1 ? allPages.length - 1 : undefined;
      }
      return undefined;
    },
    initialPageParam: 1,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Hook to refresh feed
 */
export function useRefreshFeed() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: feedKeys.all });
  };
}
