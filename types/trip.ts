/**
 * Trip and route types for activity tracking
 */

import type { Coordinate } from './location';

/**
 * Type of activity
 */
export type TripType = 'cycle' | 'walk';

/**
 * Trip status
 */
export type TripStatus = 'active' | 'paused' | 'completed' | 'cancelled';

/**
 * Complete trip data
 */
export interface Trip {
  id: string;
  userId: string;
  type: TripType;
  status: TripStatus;
  route: Coordinate[];
  distance: number; // meters
  duration: number; // seconds
  startTime: Date;
  endTime: Date | null;
  avgSpeed: number; // km/h
  maxSpeed?: number; // km/h
  elevationGain?: number; // meters
  co2Saved: number; // kg
  calories?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Trip statistics
 */
export interface TripStats {
  totalDistance: number; // meters
  totalDuration: number; // seconds
  avgSpeed: number; // km/h
  maxSpeed: number; // km/h
  elevationGain: number; // meters
  co2Saved: number; // kg
  calories: number;
}

/**
 * Route polyline for display
 */
export interface Route {
  coordinates: Coordinate[];
  color?: string;
  width?: number;
  opacity?: number;
}

/**
 * Trip preview/list item
 */
export type TripListItem = Pick<
  Trip,
  'id' | 'type' | 'distance' | 'duration' | 'startTime' | 'avgSpeed' | 'co2Saved'
>;

/**
 * Create trip DTO
 */
export interface CreateTripDto {
  type: TripType;
  distance: number;
  duration: number;
  startTime: string; // ISO string
  endTime: string; // ISO string
  route?: Coordinate[];
  avgSpeed?: number;
  maxSpeed?: number;
  elevationGain?: number;
}

/**
 * Update trip DTO
 */
export interface UpdateTripDto {
  type?: TripType;
  distance?: number;
  duration?: number;
  startTime?: string;
  endTime?: string;
  route?: Coordinate[];
}

/**
 * Trip filter options
 */
export interface TripFilters {
  type?: TripType;
  startDate?: Date;
  endDate?: Date;
  minDistance?: number;
  maxDistance?: number;
}
