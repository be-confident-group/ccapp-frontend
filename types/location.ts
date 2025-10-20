/**
 * Location and coordinate types for BeActive app
 */

/**
 * Basic coordinate with latitude and longitude
 */
export interface Coordinate {
  latitude: number;
  longitude: number;
}

/**
 * Location with additional metadata
 */
export interface Location extends Coordinate {
  altitude?: number | null;
  accuracy?: number | null;
  altitudeAccuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  timestamp?: number;
}

/**
 * Geographic region/viewport
 */
export interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

/**
 * Bounding box for map queries
 */
export interface BoundingBox {
  northEast: Coordinate;
  southWest: Coordinate;
}

/**
 * Location permission status
 */
export type LocationPermissionStatus =
  | 'granted'
  | 'denied'
  | 'undetermined'
  | 'restricted';

/**
 * Location accuracy settings
 */
export enum LocationAccuracy {
  Lowest = 1,
  Low = 2,
  Balanced = 3,
  High = 4,
  Highest = 5,
  BestForNavigation = 6,
}
