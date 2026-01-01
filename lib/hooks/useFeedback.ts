/**
 * React Query hooks for Feedback API operations
 */

import { useMutation } from '@tanstack/react-query';
import { feedbackApi, type FeedbackRequest } from '@/lib/api/feedback';

/**
 * Hook to submit feedback
 */
export function useSubmitFeedback() {
  return useMutation({
    mutationFn: (data: FeedbackRequest) => feedbackApi.submitFeedback(data),
  });
}
