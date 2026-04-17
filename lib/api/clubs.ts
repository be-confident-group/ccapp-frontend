/**
 * Club API service for backend integration
 */

import { apiClient } from './client';
import type { Club, ClubCreateRequest, ClubUpdateRequest, JoinRequest } from '@/types/feed';

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

  /**
   * Get a club by its share code
   */
  async getClubByShareCode(shareCode: string): Promise<Club> {
    try {
      return await apiClient.get<Club>(`/api/clubs/share/${shareCode}/`);
    } catch (error) {
      console.warn('[ClubAPI] Share code not found:', shareCode);
      throw error;
    }
  }

  /**
   * Submit a join request to a private club.
   */
  async requestJoin(clubId: number): Promise<JoinRequest> {
    try {
      return await apiClient.post<JoinRequest>(`/api/clubs/${clubId}/request-join/`, {});
    } catch (error) {
      console.warn('[ClubAPI] requestJoin failed:', error);
      throw error;
    }
  }

  /**
   * List pending join requests for a club (owner only).
   */
  async listJoinRequests(clubId: number): Promise<JoinRequest[]> {
    try {
      return await apiClient.get<JoinRequest[]>(`/api/clubs/${clubId}/join-requests/`);
    } catch (error) {
      console.error('[ClubAPI] Error fetching join requests:', error);
      throw error;
    }
  }

  /**
   * Accept a pending join request (owner only).
   */
  async acceptJoinRequest(requestId: number): Promise<void> {
    try {
      await apiClient.post(`/api/clubs/join-requests/${requestId}/accept/`, {});
    } catch (error) {
      console.error('[ClubAPI] Error accepting join request:', error);
      throw error;
    }
  }

  /**
   * Reject a pending join request (owner only).
   */
  async rejectJoinRequest(requestId: number): Promise<void> {
    try {
      await apiClient.post(`/api/clubs/join-requests/${requestId}/reject/`, {});
    } catch (error) {
      console.error('[ClubAPI] Error rejecting join request:', error);
      throw error;
    }
  }

  /**
   * Remove a member from a club (owner only).
   */
  async removeMember(clubId: number, userId: number): Promise<void> {
    try {
      await apiClient.post(`/api/clubs/${clubId}/remove-member/`, { user_id: userId });
    } catch (error) {
      console.error('[ClubAPI] Error removing member:', error);
      throw error;
    }
  }

  /**
   * Transfer club ownership to another member (owner only).
   */
  async transferOwnership(clubId: number, newOwnerId: number): Promise<void> {
    try {
      await apiClient.post(`/api/clubs/${clubId}/transfer-ownership/`, { new_owner_id: newOwnerId });
    } catch (error) {
      console.error('[ClubAPI] Error transferring ownership:', error);
      throw error;
    }
  }
}

export const clubAPI = new ClubAPI();
