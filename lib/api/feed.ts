/**
 * Feed API service for backend integration
 */

import { apiClient } from './client';
import type { FeedResponse } from '@/types/feed';

export type FeedType = 'all' | 'posts' | 'activities';

/**
 * Feed API service
 */
class FeedAPI {
  async getFeed(page: number = 1, pageSize: number = 20, type?: FeedType): Promise<FeedResponse> {
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('page_size', pageSize.toString());
      if (type) params.append('type', type);

      const endpoint = `/api/feed/?${params.toString()}`;
      return await apiClient.get<FeedResponse>(endpoint);
    } catch (error) {
      console.error('[FeedAPI] Error fetching feed:', error);
      throw error;
    }
  }
}

export const feedAPI = new FeedAPI();
