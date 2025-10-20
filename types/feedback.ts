/**
 * Feedback and route rating types
 */

import type { Coordinate } from './location';

/**
 * Feedback type categories
 */
export type FeedbackType =
  | 'safe_route'
  | 'hazard'
  | 'nice_view'
  | 'poor_surface'
  | 'good_infrastructure';

/**
 * Feedback marker on map
 */
export interface FeedbackMarker {
  id: string;
  userId: string;
  userName: string;
  type: FeedbackType;
  location: Coordinate;
  description: string;
  rating?: number; // 1-5 stars (optional)
  timestamp: Date;
  photoUrl?: string;
  isResolved?: boolean;
}

/**
 * Create feedback DTO
 */
export interface CreateFeedbackDto {
  type: FeedbackType;
  location: Coordinate;
  description: string;
  rating?: number;
  photoUrl?: string;
}

/**
 * Update feedback DTO
 */
export interface UpdateFeedbackDto {
  description?: string;
  rating?: number;
  isResolved?: boolean;
}

/**
 * Feedback filter options
 */
export interface FeedbackFilters {
  types?: FeedbackType[];
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  isResolved?: boolean;
}

/**
 * Feedback type metadata
 */
export interface FeedbackTypeInfo {
  type: FeedbackType;
  label: string;
  icon: string; // Heroicon name
  color: string;
  description: string;
}

/**
 * Feedback statistics
 */
export interface FeedbackStats {
  totalCount: number;
  byType: Record<FeedbackType, number>;
  resolvedCount: number;
  avgRating: number;
}
