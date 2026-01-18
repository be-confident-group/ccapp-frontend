/**
 * Road Section Ratings API service for backend integration
 */

import { apiClient } from './client';
import type { FeelingType } from '@/types/rating';

/**
 * Backend feeling values - capitalized strings or numeric 1-4
 */
export type BackendFeelingType = 'Stressed' | 'Uncomfortable' | 'Comfortable' | 'Enjoyable';

/**
 * Map frontend feeling types to backend format (capitalized)
 */
const FEELING_TO_BACKEND: Record<FeelingType, BackendFeelingType> = {
  stressed: 'Stressed',
  uncomfortable: 'Uncomfortable',
  comfortable: 'Comfortable',
  enjoyable: 'Enjoyable',
};

/**
 * API request format for a single rated segment (matches backend road-sections/submit)
 */
export interface ApiRatedSegment {
  start_lat: number;
  start_lng: number;
  end_lat: number;
  end_lng: number;
  feeling: BackendFeelingType;
}

/**
 * API request format for submitting road section ratings
 * Endpoint: POST /api/road-sections/submit/
 */
export interface SubmitRatingsRequest {
  trip_id?: number;
  client_trip_id: string;
  rated_at?: string; // ISO 8601 timestamp
  rated_segments: ApiRatedSegment[];
}

/**
 * API response format for rating submission
 */
export interface SubmitRatingsResponse {
  message: string;
}

/**
 * Road Section Ratings API class
 */
class RatingsAPI {
  /**
   * Submit road section ratings for a trip
   * Endpoint: POST /api/road-sections/submit/
   */
  async submitRatings(request: SubmitRatingsRequest): Promise<SubmitRatingsResponse> {
    console.log('[RatingsAPI] Submitting ratings for trip:', request.client_trip_id);
    console.log('[RatingsAPI] Segments count:', request.rated_segments.length);
    return apiClient.post<SubmitRatingsResponse>('/api/road-sections/submit/', request);
  }

  /**
   * Convert frontend feeling to backend format
   */
  convertFeeling(feeling: FeelingType): BackendFeelingType {
    return FEELING_TO_BACKEND[feeling];
  }
}

export const ratingsAPI = new RatingsAPI();
