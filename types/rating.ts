/**
 * Route Rating Types
 *
 * Types for the multi-segment route rating feature allowing users
 * to paint different feelings on different sections of their routes.
 */

import type { Coordinate } from './location';

/**
 * Feeling states for route segments
 * Represents the user's experience on a section of their route
 */
export type FeelingType = 'stressed' | 'uncomfortable' | 'comfortable' | 'enjoyable';

/**
 * A painted segment of a route
 * Represents a contiguous section of the route with a specific feeling
 */
export interface RouteSegment {
  startIndex: number; // Index in route coordinates array
  endIndex: number; // Index in route coordinates array (inclusive)
  feeling: FeelingType;
}

/**
 * Complete rating for a trip stored locally
 */
export interface TripRating {
  id?: number;
  tripId: string;
  segments: RouteSegment[];
  ratedAt: number; // Unix timestamp (ms)
  synced: number; // 0 or 1
  backendId: number | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * Database representation of a route rating
 */
export interface DBRouteRating {
  id?: number;
  trip_id: string;
  segments: string; // JSON stringified RouteSegment[]
  rated_at: number;
  synced: number;
  backend_id: number | null;
  created_at: number;
  updated_at: number;
}

/**
 * Backend feeling values - capitalized strings
 */
export type BackendFeelingType = 'Stressed' | 'Uncomfortable' | 'Comfortable' | 'Enjoyable';

/**
 * Map frontend feeling types to backend format (capitalized)
 */
export const FEELING_TO_BACKEND: Record<FeelingType, BackendFeelingType> = {
  stressed: 'Stressed',
  uncomfortable: 'Uncomfortable',
  comfortable: 'Comfortable',
  enjoyable: 'Enjoyable',
};

/**
 * API format for a rated segment (matches backend road-sections/submit)
 */
export interface ApiRatedSegment {
  start_lat: number;
  start_lng: number;
  end_lat: number;
  end_lng: number;
  feeling: BackendFeelingType;
}

/**
 * API format for submitting ratings to backend
 * Endpoint: POST /api/road-sections/submit/
 */
export interface SubmitRatingsRequest {
  trip_id?: number;
  client_trip_id: string;
  rated_at?: string; // ISO 8601 timestamp
  rated_segments: ApiRatedSegment[];
}

/**
 * Feeling metadata for UI display
 */
export interface FeelingInfo {
  type: FeelingType;
  label: string;
  icon: string; // MaterialCommunityIcons name
  color: string;
  backgroundColor: string; // Lighter version for backgrounds
  description: string;
}

/**
 * Feeling configuration with colors and metadata
 */
export const FEELINGS: Record<FeelingType, FeelingInfo> = {
  stressed: {
    type: 'stressed',
    label: 'Stressed',
    icon: 'emoticon-frown-outline',
    color: '#F44336',
    backgroundColor: '#FFEBEE',
    description: 'Felt unsafe or very uncomfortable',
  },
  uncomfortable: {
    type: 'uncomfortable',
    label: 'Uncomfortable',
    icon: 'emoticon-neutral-outline',
    color: '#FF9800',
    backgroundColor: '#FFF3E0',
    description: 'Some concerns or minor issues',
  },
  comfortable: {
    type: 'comfortable',
    label: 'Comfortable',
    icon: 'emoticon-happy-outline',
    color: '#8BC34A',
    backgroundColor: '#F1F8E9',
    description: 'Pleasant and safe experience',
  },
  enjoyable: {
    type: 'enjoyable',
    label: 'Enjoyable',
    icon: 'emoticon-excited-outline',
    color: '#4CAF50',
    backgroundColor: '#E8F5E9',
    description: 'Excellent, would recommend',
  },
};

/**
 * Ordered array of feelings from worst to best
 */
export const FEELING_ORDER: FeelingType[] = [
  'stressed',
  'uncomfortable',
  'comfortable',
  'enjoyable',
];

/**
 * Get feeling color
 */
export function getFeelingColor(feeling: FeelingType): string {
  return FEELINGS[feeling].color;
}

/**
 * Get feeling background color
 */
export function getFeelingBackgroundColor(feeling: FeelingType): string {
  return FEELINGS[feeling].backgroundColor;
}

/**
 * Get feeling label
 */
export function getFeelingLabel(feeling: FeelingType): string {
  return FEELINGS[feeling].label;
}

/**
 * Get feeling icon name
 */
export function getFeelingIcon(feeling: FeelingType): string {
  return FEELINGS[feeling].icon;
}

/**
 * Get feeling info object
 */
export function getFeelingInfo(feeling: FeelingType): FeelingInfo {
  return FEELINGS[feeling];
}

/**
 * Color for unpainted route segments
 */
export const UNPAINTED_COLOR = '#6B7280';

/**
 * Convert local segments to API format for submission
 * Uses route coordinates to get lat/lng for each segment
 */
export function toSubmitRatingsRequest(
  clientTripId: string,
  segments: RouteSegment[],
  route: Coordinate[],
  backendTripId?: number,
  ratedAt?: number
): SubmitRatingsRequest {
  return {
    ...(backendTripId !== undefined && { trip_id: backendTripId }),
    client_trip_id: clientTripId,
    rated_at: ratedAt ? new Date(ratedAt).toISOString() : new Date().toISOString(),
    rated_segments: segments.map((seg) => ({
      start_lat: route[seg.startIndex]?.latitude ?? 0,
      start_lng: route[seg.startIndex]?.longitude ?? 0,
      end_lat: route[seg.endIndex]?.latitude ?? 0,
      end_lng: route[seg.endIndex]?.longitude ?? 0,
      feeling: FEELING_TO_BACKEND[seg.feeling],
    })),
  };
}

/**
 * Convert DB rating to local format
 */
export function fromDBRating(dbRating: DBRouteRating): TripRating {
  return {
    id: dbRating.id,
    tripId: dbRating.trip_id,
    segments: JSON.parse(dbRating.segments) as RouteSegment[],
    ratedAt: dbRating.rated_at,
    synced: dbRating.synced,
    backendId: dbRating.backend_id,
    createdAt: dbRating.created_at,
    updatedAt: dbRating.updated_at,
  };
}

/**
 * Convert local rating to DB format
 */
export function toDBRating(rating: Partial<TripRating>): Partial<DBRouteRating> {
  const result: Partial<DBRouteRating> = {};

  if (rating.tripId !== undefined) result.trip_id = rating.tripId;
  if (rating.segments !== undefined) result.segments = JSON.stringify(rating.segments);
  if (rating.ratedAt !== undefined) result.rated_at = rating.ratedAt;
  if (rating.synced !== undefined) result.synced = rating.synced;
  if (rating.backendId !== undefined) result.backend_id = rating.backendId;
  if (rating.createdAt !== undefined) result.created_at = rating.createdAt;
  if (rating.updatedAt !== undefined) result.updated_at = rating.updatedAt;

  return result;
}

/**
 * Merge overlapping segments when painting
 * New segment overwrites existing ones in its range
 */
export function mergeSegments(
  existing: RouteSegment[],
  newSegment: RouteSegment
): RouteSegment[] {
  const result: RouteSegment[] = [];
  const newStart = Math.min(newSegment.startIndex, newSegment.endIndex);
  const newEnd = Math.max(newSegment.startIndex, newSegment.endIndex);

  for (const seg of existing) {
    // Segment is completely before new segment
    if (seg.endIndex < newStart) {
      result.push(seg);
      continue;
    }

    // Segment is completely after new segment
    if (seg.startIndex > newEnd) {
      result.push(seg);
      continue;
    }

    // Segment overlaps - need to split or trim
    // Part before new segment
    if (seg.startIndex < newStart) {
      result.push({
        startIndex: seg.startIndex,
        endIndex: newStart - 1,
        feeling: seg.feeling,
      });
    }

    // Part after new segment
    if (seg.endIndex > newEnd) {
      result.push({
        startIndex: newEnd + 1,
        endIndex: seg.endIndex,
        feeling: seg.feeling,
      });
    }
  }

  // Add the new segment
  result.push({
    startIndex: newStart,
    endIndex: newEnd,
    feeling: newSegment.feeling,
  });

  // Sort by start index and merge adjacent segments with same feeling
  result.sort((a, b) => a.startIndex - b.startIndex);

  const merged: RouteSegment[] = [];
  for (const seg of result) {
    const last = merged[merged.length - 1];
    // Merge adjacent segments OR close small gaps (≤3 points) between same feelings
    const gap = seg.startIndex - (last?.endIndex ?? -999);
    if (last && last.feeling === seg.feeling && gap >= 1 && gap <= 4) {
      // Extend last segment to cover the gap and include this segment
      last.endIndex = seg.endIndex;
    } else {
      merged.push({ ...seg });
    }
  }

  return merged;
}
