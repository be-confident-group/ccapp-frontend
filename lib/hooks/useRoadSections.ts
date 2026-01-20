/**
 * React Query hooks for Road Sections API operations
 */

import { useQuery } from '@tanstack/react-query';
import { roadSectionsApi } from '@/lib/api/roadSections';

/**
 * Large bbox covering all of UK/Western Europe - effectively fetches ALL ratings
 * This avoids the complexity of viewport-based filtering
 */
const ALL_RATINGS_BBOX = '-10,35,20,65';

/**
 * Query key factory for road sections
 */
export const roadSectionKeys = {
  all: ['roadSections'] as const,
  personal: () => [...roadSectionKeys.all, 'personal'] as const,
  community: () => [...roadSectionKeys.all, 'community'] as const,
  communityWithParams: (minRatingCount?: number) =>
    [...roadSectionKeys.community(), { minRatingCount }] as const,
};

/**
 * Hook to fetch ALL of user's personal road section ratings
 * @param enabled - Whether to enable the query (defaults to true)
 */
export function usePersonalRoadSections(enabled: boolean = true) {
  return useQuery({
    queryKey: roadSectionKeys.personal(),
    queryFn: () => roadSectionsApi.getPersonalRoadSections(ALL_RATINGS_BBOX),
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes cache (longer since we fetch all)
  });
}

/**
 * Hook to fetch ALL community road section scores
 * @param enabled - Whether to enable the query (defaults to true)
 * @param minRatingCount - Optional minimum rating count threshold
 */
export function useCommunityRoadSections(enabled: boolean = true, minRatingCount?: number) {
  return useQuery({
    queryKey: roadSectionKeys.communityWithParams(minRatingCount),
    queryFn: () => roadSectionsApi.getCommunityRoadSections(ALL_RATINGS_BBOX, minRatingCount),
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });
}
