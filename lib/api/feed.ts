/**
 * Feed API service for backend integration
 */

import { apiClient } from './client';
import type { FeedResponse } from '@/types/feed';

/**
 * Feed API service
 */
class FeedAPI {
  /**
   * Get user feed (posts from all clubs user is a member of)
   * @param page - Page number (default: 1)
   * @param pageSize - Number of items per page (default: 20)
   */
  async getFeed(page: number = 1, pageSize: number = 20): Promise<FeedResponse> {
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('page_size', pageSize.toString());

      const endpoint = `/api/feed/?${params.toString()}`;
      return await apiClient.get<FeedResponse>(endpoint);
    } catch (error) {
      console.error('[FeedAPI] Error fetching feed:', error);
      throw error;
    }
  }
}

export const feedAPI = new FeedAPI();
