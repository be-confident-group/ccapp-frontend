/**
 * Route Ratings API service for backend integration
 */

import { apiClient } from './client';
import type { ApiRouteRating, ApiRouteRatingResponse, FeelingType } from '@/types/rating';

/**
 * API request format for a single route segment
 */
export interface ApiSegmentRequest {
  start_index: number;
  end_index: number;
  feeling: FeelingType;
  start_coord: { lat: number; lng: number };
  end_coord: { lat: number; lng: number };
}

/**
 * API request format for creating/updating a rating
 */
export interface CreateRatingRequest {
  trip_id: number;
  client_trip_id: string;
  segments: ApiSegmentRequest[];
}

/**
 * API response format for a rating
 */
export interface RatingResponse {
  id: number;
  trip_id: number;
  client_trip_id: string;
  segments: ApiSegmentRequest[];
  created_at: string;
  updated_at: string;
}

/**
 * Bulk sync request format
 */
export interface SyncRatingsRequest {
  ratings: CreateRatingRequest[];
}

/**
 * Bulk sync response format
 */
export interface SyncRatingsResponse {
  synced: Array<{
    id: number;
    client_trip_id: string;
  }>;
  failed: Array<{
    client_trip_id: string;
    error: string;
  }>;
}

/**
 * Route Ratings API class
 */
class RatingsAPI {
  /**
   * Create or update a rating for a trip
   */
  async createRating(rating: CreateRatingRequest): Promise<RatingResponse> {
    console.log('[RatingsAPI] Creating rating for trip:', rating.client_trip_id);
    return apiClient.post<RatingResponse>('/api/route-ratings/', rating);
  }

  /**
   * Get rating for a specific trip by backend trip ID
   */
  async getRating(tripId: number): Promise<RatingResponse | null> {
    try {
      console.log('[RatingsAPI] Fetching rating for trip:', tripId);
      return await apiClient.get<RatingResponse>(`/api/route-ratings/${tripId}/`);
    } catch (error) {
      // Return null if rating doesn't exist (404)
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get rating by client trip ID
   */
  async getRatingByClientId(clientTripId: string): Promise<RatingResponse | null> {
    try {
      console.log('[RatingsAPI] Fetching rating by client ID:', clientTripId);
      return await apiClient.get<RatingResponse>(
        `/api/route-ratings/by-client/${clientTripId}/`
      );
    } catch (error) {
      // Return null if rating doesn't exist (404)
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Update an existing rating
   */
  async updateRating(
    tripId: number,
    updates: Partial<CreateRatingRequest>
  ): Promise<RatingResponse> {
    console.log('[RatingsAPI] Updating rating for trip:', tripId);
    return apiClient.patch<RatingResponse>(`/api/route-ratings/${tripId}/`, updates);
  }

  /**
   * Delete a rating
   */
  async deleteRating(tripId: number): Promise<void> {
    console.log('[RatingsAPI] Deleting rating for trip:', tripId);
    await apiClient.delete(`/api/route-ratings/${tripId}/`);
  }

  /**
   * Bulk sync multiple ratings
   */
  async syncRatings(ratings: CreateRatingRequest[]): Promise<SyncRatingsResponse> {
    if (ratings.length === 0) {
      return { synced: [], failed: [] };
    }

    console.log('[RatingsAPI] Syncing', ratings.length, 'ratings');
    return apiClient.post<SyncRatingsResponse>('/api/route-ratings/sync/', {
      ratings,
    });
  }

  /**
   * Get all ratings for the current user
   */
  async getAllRatings(): Promise<RatingResponse[]> {
    console.log('[RatingsAPI] Fetching all ratings');
    return apiClient.get<RatingResponse[]>('/api/route-ratings/');
  }
}

export const ratingsAPI = new RatingsAPI();
