import { apiClient } from './client';

/**
 * Map feedback types
 */
export type MapFeedbackType = 'point' | 'path' | 'area';
export type MapFeedbackCategory = 'road_damage' | 'traffic_light' | 'safety_issue' | 'other';

/**
 * GeoJSON geometry types
 */
export interface GeoJSONPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface GeoJSONLineString {
  type: 'LineString';
  coordinates: Array<[number, number]>;
}

export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: Array<Array<[number, number]>>;
}

export type GeoJSONGeometry = GeoJSONPoint | GeoJSONLineString | GeoJSONPolygon;

/**
 * Map feedback from backend
 */
export interface MapFeedback {
  id: number;
  user: number;
  type: MapFeedbackType;
  category: MapFeedbackCategory;
  coordinates: GeoJSONGeometry;
  title: string;
  description: string;
  created_at: string;
}

/**
 * Request payload for creating map feedback
 */
export interface CreateMapFeedbackRequest {
  type: MapFeedbackType;
  category: MapFeedbackCategory;
  coordinates: GeoJSONGeometry;
  title: string;
  description: string;
}

/**
 * Request payload for updating map feedback
 */
export interface UpdateMapFeedbackRequest {
  title?: string;
  description?: string;
}

/**
 * API client for map feedback operations
 */
class MapFeedbackApi {
  /**
   * Get user's map feedback reports
   */
  async getMyFeedback(): Promise<MapFeedback[]> {
    try {
      return await apiClient.get<MapFeedback[]>('/api/map-feedback/');
    } catch (error) {
      console.error('[MapFeedbackAPI] Error fetching feedback:', error);
      throw error;
    }
  }

  /**
   * Create a new map feedback report
   */
  async createFeedback(data: CreateMapFeedbackRequest): Promise<MapFeedback> {
    try {
      // Log the full request payload for backend debugging
      console.log('[MapFeedbackAPI] ========================================');
      console.log('[MapFeedbackAPI] Creating map feedback report');
      console.log('[MapFeedbackAPI] Request payload:', JSON.stringify(data, null, 2));
      console.log('[MapFeedbackAPI] Endpoint: POST /api/map-feedback/');
      console.log('[MapFeedbackAPI] ========================================');

      const response = await apiClient.post<MapFeedback>('/api/map-feedback/', data);

      console.log('[MapFeedbackAPI] Success! Response:', JSON.stringify(response, null, 2));
      return response;
    } catch (error) {
      console.error('[MapFeedbackAPI] Error creating feedback:', error);
      throw error;
    }
  }

  /**
   * Update a map feedback report
   */
  async updateFeedback(id: number, data: UpdateMapFeedbackRequest): Promise<MapFeedback> {
    try {
      return await apiClient.patch<MapFeedback>(`/api/map-feedback/${id}/`, data);
    } catch (error) {
      console.error('[MapFeedbackAPI] Error updating feedback:', error);
      throw error;
    }
  }

  /**
   * Delete a map feedback report
   */
  async deleteFeedback(id: number): Promise<void> {
    try {
      await apiClient.delete(`/api/map-feedback/${id}/`);
    } catch (error) {
      console.error('[MapFeedbackAPI] Error deleting feedback:', error);
      throw error;
    }
  }
}

export const mapFeedbackApi = new MapFeedbackApi();
