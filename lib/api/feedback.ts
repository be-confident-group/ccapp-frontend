import { apiClient } from './client';

/**
 * Feedback category types
 */
export type FeedbackCategory = 'bug' | 'feature' | 'general' | 'other';

/**
 * Request payload for submitting feedback
 */
export interface FeedbackRequest {
  text: string;
  category: FeedbackCategory;
  email?: string; // Required for unauthenticated users
  metadata?: Record<string, any>;
}

/**
 * Response from feedback submission
 */
export interface FeedbackResponse {
  message: string;
}

/**
 * API client for feedback operations
 */
class FeedbackApi {
  /**
   * Submit feedback to the backend
   */
  async submitFeedback(data: FeedbackRequest): Promise<FeedbackResponse> {
    try {
      return await apiClient.post<FeedbackResponse>('/api/feedback/', data);
    } catch (error) {
      console.error('[FeedbackAPI] Error submitting feedback:', error);
      throw error;
    }
  }
}

export const feedbackApi = new FeedbackApi();
