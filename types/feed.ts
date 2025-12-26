/**
 * Feed-related type definitions
 */

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
