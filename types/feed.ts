/**
 * Feed-related type definitions matching backend API schema
 */

import type { TripType } from './trip';

/**
 * Simple user profile (used in clubs, posts, comments)
 */
export interface SimpleProfile {
  name: string;
  last_name: string;
  profile_picture: string | null;
}

/**
 * Club/Group definition
 */
export interface Club {
  id: number;
  name: string;
  description: string;
  photo: string | null;
  owner: SimpleProfile;
  members: SimpleProfile[];
  members_count: number;
}

/**
 * Club create/update request
 */
export interface ClubCreateRequest {
  name: string;
  description?: string;
  photo?: string; // Base64 encoded
}

export interface ClubUpdateRequest {
  name?: string;
  description?: string;
  photo?: string; // Base64 encoded
}

/**
 * Post photo
 */
export interface PostPhoto {
  id: number;
  image: string | null;
}

/**
 * Trip data (when post is linked to a trip)
 */
export interface TripData {
  id: number;
  type: TripType;
  distance: number;
  duration: number;
  average_speed: number;
  start_timestamp: string;
  end_timestamp: string;
  co2_saved: number;
}

/**
 * Post definition
 */
export interface Post {
  id: number;
  club: string; // Club name
  club_id: number;
  trip: TripData | null;
  author: SimpleProfile;
  title: string;
  text: string;
  created_at: string;
  updated_at: string;
  photos: PostPhoto[];
  comment_count: number;
}

/**
 * Post create request
 */
export interface PostCreateRequest {
  title: string;
  text: string;
  photos_data?: string[]; // Array of base64 encoded images
}

/**
 * Post update request
 */
export interface PostUpdateRequest {
  title?: string;
  text?: string;
}

/**
 * Comment definition
 */
export interface PostComment {
  id: number;
  author: SimpleProfile;
  text: string;
  created_at: string;
  updated_at: string;
}

/**
 * Comment create request
 */
export interface PostCommentCreateRequest {
  text: string;
}

/**
 * Feed response (paginated)
 */
export interface FeedResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Post[];
}

// Legacy types for backward compatibility (to be phased out)
export interface FeedUser {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface FeedGroup {
  id: string;
  name: string;
  logoUrl?: string;
  memberCount: number;
}

export interface ActivityPost {
  id: string;
  user: FeedUser;
  location?: string;
  photos: string[];
  caption: string;
  activityType: 'walk' | 'ride' | 'run';
  distance?: number;
  duration?: number;
  likeCount: number;
  commentCount: number;
  isLiked: boolean;
  createdAt: string;
  groupId?: string;
}

export interface Comment {
  id: string;
  user: FeedUser;
  text: string;
  createdAt: string;
}
