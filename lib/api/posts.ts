/**
 * Posts API service for backend integration
 */

import { apiClient } from './client';
import type {
  Post,
  PostCreateRequest,
  PostUpdateRequest,
  PostComment,
  PostCommentCreateRequest,
  PostPhoto,
} from '@/types/feed';

/**
 * Post filters for querying
 */
export interface PostFilters {
  title?: string;
  start_date?: string; // YYYY-MM-DD
  end_date?: string; // YYYY-MM-DD
}

/**
 * Posts API service
 */
class PostAPI {
  /**
   * Get all posts for a specific club
   */
  async getClubPosts(clubId: number, filters?: PostFilters): Promise<Post[]> {
    try {
      const params = new URLSearchParams();

      if (filters?.title) {
        params.append('title', filters.title);
      }
      if (filters?.start_date) {
        params.append('start_date', filters.start_date);
      }
      if (filters?.end_date) {
        params.append('end_date', filters.end_date);
      }

      const queryString = params.toString();
      const endpoint = queryString
        ? `/api/clubs/${clubId}/posts/?${queryString}`
        : `/api/clubs/${clubId}/posts/`;

      return await apiClient.get<Post[]>(endpoint);
    } catch (error) {
      console.error('[PostAPI] Error fetching club posts:', error);
      throw error;
    }
  }

  /**
   * Get a specific post
   */
  async getPost(clubId: number, postId: number): Promise<Post> {
    try {
      return await apiClient.get<Post>(`/api/clubs/${clubId}/posts/${postId}/`);
    } catch (error) {
      console.error('[PostAPI] Error fetching post:', error);
      throw error;
    }
  }

  /**
   * Create a new post in a club
   */
  async createPost(clubId: number, data: PostCreateRequest): Promise<Post> {
    try {
      console.log('[PostAPI] Creating post:', {
        clubId,
        title: data.title,
        photoCount: data.photos_data?.length || 0,
      });
      return await apiClient.post<Post>(`/api/clubs/${clubId}/posts/`, data);
    } catch (error) {
      console.error('[PostAPI] Error creating post:', error);
      throw error;
    }
  }

  /**
   * Update a post (author only)
   */
  async updatePost(clubId: number, postId: number, data: PostUpdateRequest): Promise<Post> {
    try {
      console.log('[PostAPI] Updating post:', { clubId, postId, updates: Object.keys(data) });
      return await apiClient.patch<Post>(`/api/clubs/${clubId}/posts/${postId}/`, data);
    } catch (error) {
      console.error('[PostAPI] Error updating post:', error);
      throw error;
    }
  }

  /**
   * Delete a post (author only)
   */
  async deletePost(clubId: number, postId: number): Promise<void> {
    try {
      console.log('[PostAPI] Deleting post:', { clubId, postId });
      await apiClient.delete(`/api/clubs/${clubId}/posts/${postId}/`);
    } catch (error) {
      console.error('[PostAPI] Error deleting post:', error);
      throw error;
    }
  }

  /**
   * Add a photo to a post
   */
  async addPhoto(clubId: number, postId: number, imageData: string): Promise<PostPhoto> {
    try {
      console.log('[PostAPI] Adding photo to post:', { clubId, postId });
      return await apiClient.post<PostPhoto>(
        `/api/clubs/${clubId}/posts/${postId}/photos/add/`,
        { image_data: imageData }
      );
    } catch (error) {
      console.error('[PostAPI] Error adding photo:', error);
      throw error;
    }
  }

  /**
   * Remove a photo from a post
   */
  async removePhoto(clubId: number, postId: number, photoId: number): Promise<void> {
    try {
      console.log('[PostAPI] Removing photo from post:', { clubId, postId, photoId });
      await apiClient.delete(`/api/clubs/${clubId}/posts/${postId}/photos/${photoId}/remove/`);
    } catch (error) {
      console.error('[PostAPI] Error removing photo:', error);
      throw error;
    }
  }

  /**
   * Add a comment to a post
   */
  async addComment(
    clubId: number,
    postId: number,
    data: PostCommentCreateRequest
  ): Promise<PostComment> {
    try {
      console.log('[PostAPI] Adding comment to post:', { clubId, postId });
      return await apiClient.post<PostComment>(
        `/api/clubs/${clubId}/posts/${postId}/comments/`,
        data
      );
    } catch (error) {
      console.error('[PostAPI] Error adding comment:', error);
      throw error;
    }
  }

  /**
   * Delete a comment (author only)
   */
  async deleteComment(clubId: number, postId: number, commentId: number): Promise<void> {
    try {
      console.log('[PostAPI] Deleting comment:', { clubId, postId, commentId });
      await apiClient.delete(`/api/clubs/${clubId}/posts/${postId}/comments/${commentId}/`);
    } catch (error) {
      console.error('[PostAPI] Error deleting comment:', error);
      throw error;
    }
  }
}

export const postAPI = new PostAPI();
