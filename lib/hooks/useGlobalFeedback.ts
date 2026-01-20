/**
 * React Query hooks for Global Feedback API operations
 */

import { useQuery } from '@tanstack/react-query';
import { globalFeedbackApi, type ConfidenceLevel } from '@/lib/api/globalFeedback';

/**
 * Large bbox covering all of UK/Western Europe - effectively fetches ALL feedback
 */
const ALL_FEEDBACK_BBOX = '-10,35,20,65';

/**
 * Query key factory for global feedback
 */
export const globalFeedbackKeys = {
  all: ['globalFeedback'] as const,
  list: (confidenceLevel?: ConfidenceLevel) =>
    [...globalFeedbackKeys.all, { confidenceLevel }] as const,
};

/**
 * Hook to fetch ALL global/community feedback records
 * @param enabled - Whether to enable the query (defaults to true)
 * @param confidenceLevel - Optional confidence level filter
 */
export function useGlobalFeedback(enabled: boolean = true, confidenceLevel?: ConfidenceLevel) {
  return useQuery({
    queryKey: globalFeedbackKeys.list(confidenceLevel),
    queryFn: () => globalFeedbackApi.getGlobalFeedback({ bbox: ALL_FEEDBACK_BBOX, confidence_level: confidenceLevel }),
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });
}
