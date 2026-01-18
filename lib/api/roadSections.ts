import { apiClient } from './client';
import type { GeoJSONLineString } from './mapFeedback';

/**
 * Personal road section rating from backend
 */
export interface RoadSectionPersonal {
  section_id: string;
  geometry: GeoJSONLineString;
  rating: number; // 1=Stressed, 2=Uncomfortable, 3=Comfortable, 4=Enjoyable
}

/**
 * Community road section with aggregated score
 */
export interface RoadSectionCommunity {
  section_id: string;
  geometry: GeoJSONLineString;
  community_score: number; // Weighted average 1-4
  rating_count: number;
}

/**
 * Rating labels for display
 */
export const RATING_LABELS: Record<number, string> = {
  1: 'Stressed',
  2: 'Uncomfortable',
  3: 'Comfortable',
  4: 'Enjoyable',
};

/**
 * Rating colors (red to green gradient)
 */
export const RATING_COLORS: Record<number, string> = {
  1: '#EF4444', // Red - Stressed
  2: '#F97316', // Orange - Uncomfortable
  3: '#84CC16', // Yellow-Green - Comfortable
  4: '#22C55E', // Green - Enjoyable
};

/**
 * Get color for a rating value (handles floats for community scores)
 */
export function getRatingColor(rating: number): string {
  if (rating <= 1) return RATING_COLORS[1];
  if (rating <= 2) return RATING_COLORS[2];
  if (rating <= 3) return RATING_COLORS[3];
  return RATING_COLORS[4];
}

/**
 * API client for road sections operations
 */
class RoadSectionsApi {
  /**
   * Get user's personal road section ratings
   * @param bbox - Bounding box "min_lon,min_lat,max_lon,max_lat"
   */
  async getPersonalRoadSections(bbox: string): Promise<RoadSectionPersonal[]> {
    try {
      const endpoint = `/api/road-sections/personal/?bbox=${encodeURIComponent(bbox)}`;
      console.log('[RoadSectionsAPI] Fetching personal road sections:', endpoint);
      return await apiClient.get<RoadSectionPersonal[]>(endpoint);
    } catch (error) {
      console.error('[RoadSectionsAPI] Error fetching personal road sections:', error);
      throw error;
    }
  }

  /**
   * Get community road section scores
   * @param bbox - Bounding box "min_lon,min_lat,max_lon,max_lat"
   * @param minRatingCount - Optional minimum ratings threshold
   */
  async getCommunityRoadSections(
    bbox: string,
    minRatingCount?: number
  ): Promise<RoadSectionCommunity[]> {
    try {
      let endpoint = `/api/road-sections/community/?bbox=${encodeURIComponent(bbox)}`;
      if (minRatingCount !== undefined) {
        endpoint += `&min_rating_count=${minRatingCount}`;
      }
      console.log('[RoadSectionsAPI] Fetching community road sections:', endpoint);
      return await apiClient.get<RoadSectionCommunity[]>(endpoint);
    } catch (error) {
      console.error('[RoadSectionsAPI] Error fetching community road sections:', error);
      throw error;
    }
  }
}

export const roadSectionsApi = new RoadSectionsApi();
