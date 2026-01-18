/**
 * React Query hooks for Road Sections API operations
 */

import { useQuery } from '@tanstack/react-query';
import { roadSectionsApi } from '@/lib/api/roadSections';

/**
 * Query key factory for road sections
 */
export const roadSectionKeys = {
  all: ['roadSections'] as const,
  personal: () => [...roadSectionKeys.all, 'personal'] as const,
  personalBbox: (bbox?: string) => [...roadSectionKeys.personal(), { bbox }] as const,
  community: () => [...roadSectionKeys.all, 'community'] as const,
  communityBbox: (bbox?: string, minRatingCount?: number) =>
    [...roadSectionKeys.community(), { bbox, minRatingCount }] as const,
};

/**
 * Hook to fetch user's personal road section ratings
 * @param bbox - Bounding box string "min_lon,min_lat,max_lon,max_lat"
 */
export function usePersonalRoadSections(bbox?: string) {
  return useQuery({
    queryKey: roadSectionKeys.personalBbox(bbox),
    queryFn: () => roadSectionsApi.getPersonalRoadSections(bbox!),
    enabled: !!bbox, // Only fetch when bbox is available
    staleTime: 1000 * 60 * 2, // 2 minutes cache
  });
}

/**
 * Hook to fetch community road section scores
 * @param bbox - Bounding box string "min_lon,min_lat,max_lon,max_lat"
 * @param minRatingCount - Optional minimum rating count threshold
 */
export function useCommunityRoadSections(bbox?: string, minRatingCount?: number) {
  return useQuery({
    queryKey: roadSectionKeys.communityBbox(bbox, minRatingCount),
    queryFn: () => roadSectionsApi.getCommunityRoadSections(bbox!, minRatingCount),
    enabled: !!bbox, // Only fetch when bbox is available
    staleTime: 1000 * 60 * 2, // 2 minutes cache
  });
}
