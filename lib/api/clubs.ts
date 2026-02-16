/**
 * Club API service for backend integration
 */

import { apiClient } from './client';
import type { Club, ClubCreateRequest, ClubUpdateRequest } from '@/types/feed';

/**
 * Club API service
 */
class ClubAPI {
  /**
   * Get all clubs (optionally filtered by search query)
   */
  async getClubs(search?: string): Promise<Club[]> {
    try {
      const endpoint = search ? `/api/clubs/?search=${encodeURIComponent(search)}` : '/api/clubs/';
      return await apiClient.get<Club[]>(endpoint);
    } catch (error) {
      console.error('[ClubAPI] Error fetching clubs:', error);
      throw error;
    }
  }

  /**
   * Get clubs the user is a member of
   */
  async getMyClubs(): Promise<Club[]> {
    try {
      return await apiClient.get<Club[]>('/api/clubs/my/');
    } catch (error) {
      console.error('[ClubAPI] Error fetching my clubs:', error);
      throw error;
    }
  }

  /**
   * Get a specific club by ID
   */
  async getClub(id: number): Promise<Club> {
    try {
      return await apiClient.get<Club>(`/api/clubs/${id}/`);
    } catch (error) {
      console.error('[ClubAPI] Error fetching club:', error);
      throw error;
    }
  }

  /**
   * Create a new club
   */
  async createClub(data: ClubCreateRequest): Promise<Club> {
    try {
      console.log('[ClubAPI] Creating club:', { name: data.name, hasPhoto: !!data.photo });
      return await apiClient.post<Club>('/api/clubs/', data);
    } catch (error) {
      console.warn('[ClubAPI] Club creation failed:', (error as Error).message);
      throw error;
    }
  }

  /**
   * Update a club (owner only)
   */
  async updateClub(id: number, data: ClubUpdateRequest): Promise<Club> {
    try {
      console.log('[ClubAPI] Updating club:', { id, updates: Object.keys(data) });
      return await apiClient.patch<Club>(`/api/clubs/${id}/`, data);
    } catch (error) {
      console.error('[ClubAPI] Error updating club:', error);
      throw error;
    }
  }

  /**
   * Delete a club (owner only)
   */
  async deleteClub(id: number): Promise<void> {
    try {
      console.log('[ClubAPI] Deleting club:', id);
      await apiClient.delete(`/api/clubs/${id}/`);
    } catch (error) {
      console.error('[ClubAPI] Error deleting club:', error);
      throw error;
    }
  }

  /**
   * Join a club
   */
  async joinClub(id: number): Promise<void> {
    try {
      console.log('[ClubAPI] Joining club:', id);
      await apiClient.post(`/api/clubs/${id}/join/`, {});
    } catch (error) {
      console.error('[ClubAPI] Error joining club:', error);
      throw error;
    }
  }

  /**
   * Leave a club
   */
  async leaveClub(id: number): Promise<void> {
    try {
      console.log('[ClubAPI] Leaving club:', id);
      await apiClient.post(`/api/clubs/${id}/leave/`, {});
    } catch (error) {
      console.error('[ClubAPI] Error leaving club:', error);
      throw error;
    }
  }
}

export const clubAPI = new ClubAPI();
