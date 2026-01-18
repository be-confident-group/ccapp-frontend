/**
 * React Query hooks for Global Feedback API operations
 */

import { useQuery } from '@tanstack/react-query';
import { globalFeedbackApi, type ConfidenceLevel } from '@/lib/api/globalFeedback';

/**
 * Query key factory for global feedback
 */
export const globalFeedbackKeys = {
  all: ['globalFeedback'] as const,
  bboxes: () => [...globalFeedbackKeys.all, 'bbox'] as const,
  bbox: (bbox?: string, confidenceLevel?: ConfidenceLevel) =>
    [...globalFeedbackKeys.bboxes(), { bbox, confidenceLevel }] as const,
};

/**
 * Hook to fetch global/community feedback records
 * @param bbox - Bounding box string "min_lon,min_lat,max_lon,max_lat"
 * @param confidenceLevel - Optional confidence level filter
 */
export function useGlobalFeedback(bbox?: string, confidenceLevel?: ConfidenceLevel) {
  return useQuery({
    queryKey: globalFeedbackKeys.bbox(bbox, confidenceLevel),
    queryFn: () => globalFeedbackApi.getGlobalFeedback({ bbox, confidence_level: confidenceLevel }),
    enabled: !!bbox, // Only fetch when bbox is available
    staleTime: 1000 * 60 * 2, // 2 minutes cache
  });
}
