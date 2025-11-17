/**
 * Trip and route types for activity tracking
 */

import type { Coordinate } from './location';

/**
 * Type of activity
 */
export type TripType = 'walk' | 'run' | 'cycle' | 'drive';

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
  status?: TripStatus;
  synced?: boolean;
  startDate?: number;
  endDate?: number;
  minDistance?: number;
  maxDistance?: number;
}

/**
 * Manual trip entry DTO
 */
export interface ManualTripDto {
  userId: string;
  type: TripType;
  distance: number; // meters
  duration: number; // seconds
  startTime: number;
  notes?: string;
  routeData?: Coordinate[];
}

/**
 * Get display name for trip type
 */
export function getTripTypeName(type: TripType): string {
  const names: Record<TripType, string> = {
    walk: 'Walking',
    run: 'Running',
    cycle: 'Cycling',
    drive: 'Driving',
  };
  return names[type];
}

/**
 * Get icon name for trip type
 */
export function getTripTypeIcon(type: TripType): string {
  const icons: Record<TripType, string> = {
    walk: 'walk',
    run: 'run-fast',
    cycle: 'bicycle',
    drive: 'car',
  };
  return icons[type];
}

/**
 * Get color for trip type
 */
export function getTripTypeColor(type: TripType): string {
  const colors: Record<TripType, string> = {
    walk: '#4CAF50',
    run: '#FF9800',
    cycle: '#2196F3',
    drive: '#F44336',
  };
  return colors[type];
}

/**
 * Get status display name
 */
export function getTripStatusName(status: TripStatus): string {
  const names: Record<TripStatus, string> = {
    active: 'Active',
    paused: 'Paused',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  return names[status];
}

/**
 * Get status color
 */
export function getTripStatusColor(status: TripStatus): string {
  const colors: Record<TripStatus, string> = {
    active: '#4CAF50',
    paused: '#FF9800',
    completed: '#2196F3',
    cancelled: '#9E9E9E',
  };
  return colors[status];
}
