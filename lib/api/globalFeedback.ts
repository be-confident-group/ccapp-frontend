import { apiClient } from './client';
import type { MapFeedbackCategory, GeoJSONGeometry } from './mapFeedback';

/**
 * Confidence levels for global feedback
 */
export type ConfidenceLevel = 'low' | 'medium' | 'high';

/**
 * Global feedback from backend (aggregated community data)
 */
export interface GlobalFeedback {
  id: number;
  category: MapFeedbackCategory;
  representative_geometry: GeoJSONGeometry;
  confidence_score: number;
  confidence_level: ConfidenceLevel;
  signal_strength: number;
  is_active: boolean;
  last_processed_at: string;
  created_at: string;
}

/**
 * Query parameters for global feedback endpoint
 */
export interface GlobalFeedbackParams {
  bbox?: string; // "min_lon,min_lat,max_lon,max_lat"
  confidence_level?: ConfidenceLevel;
}

/**
 * API client for global feedback operations
 */
class GlobalFeedbackApi {
  /**
   * Get global/community feedback records
   * @param params - Query parameters including bbox and confidence_level
   */
  async getGlobalFeedback(params: GlobalFeedbackParams = {}): Promise<GlobalFeedback[]> {
    try {
      const queryParams = new URLSearchParams();

      if (params.bbox) {
        queryParams.append('bbox', params.bbox);
      }

      if (params.confidence_level) {
        queryParams.append('confidence_level', params.confidence_level);
      }

      const endpoint = `/api/global-feedback/${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

      console.log('[GlobalFeedbackAPI] Fetching global feedback:', endpoint);

      return await apiClient.get<GlobalFeedback[]>(endpoint);
    } catch (error) {
      console.error('[GlobalFeedbackAPI] Error fetching global feedback:', error);
      throw error;
    }
  }
}

export const globalFeedbackApi = new GlobalFeedbackApi();
