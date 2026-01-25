/**
 * Geo Calculations Utility
 *
 * Functions for distance, speed, elevation, and route calculations.
 */

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface CoordinateWithAltitude extends Coordinate {
  altitude?: number | null;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in meters
 *
 * @param from - Starting coordinate
 * @param to - Ending coordinate
 * @returns Distance in meters
 */
export function calculateDistance(from: Coordinate, to: Coordinate): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (from.latitude * Math.PI) / 180;
  const φ2 = (to.latitude * Math.PI) / 180;
  const Δφ = ((to.latitude - from.latitude) * Math.PI) / 180;
  const Δλ = ((to.longitude - from.longitude) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Calculate total distance for a route (array of coordinates)
 * Returns distance in meters
 */
export function calculateRouteDistance(coordinates: Coordinate[]): number {
  if (coordinates.length < 2) return 0;

  let totalDistance = 0;

  for (let i = 1; i < coordinates.length; i++) {
    totalDistance += calculateDistance(coordinates[i - 1], coordinates[i]);
  }

  return totalDistance;
}

/**
 * Calculate speed in km/h from distance (m) and time (s)
 */
export function calculateSpeed(distanceMeters: number, timeSeconds: number): number {
  if (timeSeconds === 0) return 0;
  return (distanceMeters / timeSeconds) * 3.6; // Convert m/s to km/h
}

/**
 * Format distance for display
 * @param meters - Distance in meters
 * @param unit - 'metric' or 'imperial'
 */
export function formatDistance(meters: number, unit: 'metric' | 'imperial' = 'metric'): string {
  if (unit === 'imperial') {
    const miles = meters * 0.000621371;
    if (miles < 0.1) {
      const feet = meters * 3.28084;
      return `${Math.round(feet)} ft`;
    }
    return `${miles.toFixed(2)} mi`;
  }

  // Metric
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}

/**
 * Format speed for display
 */
export function formatSpeed(kmh: number | null | undefined, unit: 'metric' | 'imperial' = 'metric'): string {
  if (kmh == null || isNaN(kmh)) {
    return unit === 'imperial' ? '0.0 mph' : '0.0 km/h';
  }
  if (unit === 'imperial') {
    const mph = kmh * 0.621371;
    return `${mph.toFixed(1)} mph`;
  }
  return `${kmh.toFixed(1)} km/h`;
}

/**
 * Format duration as HH:MM:SS or MM:SS
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format duration in human-readable format
 */
export function formatDurationHuman(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }
  if (secs > 0 || parts.length === 0) {
    parts.push(`${secs}s`);
  }

  return parts.join(' ');
}

/**
 * Calculate CO2 saved (cycling vs car)
 * Average car emits ~120g CO2 per km
 *
 * @param distanceKm - Distance in kilometers
 * @returns CO2 saved in kg
 */
export function calculateCO2Saved(distanceKm: number): number {
  return distanceKm * 0.12; // kg of CO2
}

/**
 * Calculate calories burned
 * Rough estimates based on activity type and distance
 *
 * @param distanceKm - Distance in kilometers
 * @param activityType - Type of activity
 * @param weightKg - User weight in kg (default 70kg)
 */
export function calculateCalories(
  distanceKm: number,
  activityType: 'walking' | 'running' | 'cycling',
  weightKg: number = 70
): number {
  // Calories per km per kg of body weight
  const caloriesPerKmPerKg: Record<string, number> = {
    walking: 0.57,
    running: 1.0,
    cycling: 0.5,
  };

  const rate = caloriesPerKmPerKg[activityType] || 0.5;
  return Math.round(distanceKm * rate * weightKg);
}

/**
 * Calculate elevation gain from altitude array
 */
export function calculateElevationGain(altitudes: (number | null | undefined)[]): number {
  let gain = 0;

  for (let i = 1; i < altitudes.length; i++) {
    const prev = altitudes[i - 1];
    const curr = altitudes[i];

    if (prev != null && curr != null && curr > prev) {
      gain += curr - prev;
    }
  }

  return gain;
}

/**
 * Calculate elevation loss from altitude array
 */
export function calculateElevationLoss(altitudes: (number | null | undefined)[]): number {
  let loss = 0;

  for (let i = 1; i < altitudes.length; i++) {
    const prev = altitudes[i - 1];
    const curr = altitudes[i];

    if (prev != null && curr != null && curr < prev) {
      loss += prev - curr;
    }
  }

  return loss;
}

/**
 * Simplify route using Douglas-Peucker algorithm
 * Reduces number of points while preserving shape
 *
 * @param points - Array of coordinates
 * @param tolerance - Tolerance in degrees (default 0.0001 ≈ 11m)
 * @returns Simplified array of coordinates
 */
export function simplifyRoute(points: Coordinate[], tolerance: number = 0.0001): Coordinate[] {
  if (points.length <= 2) return points;

  // Find point with maximum distance from line
  let maxDistance = 0;
  let maxIndex = 0;
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i], firstPoint, lastPoint);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }

  // If max distance is greater than tolerance, recursively simplify
  if (maxDistance > tolerance) {
    const left = simplifyRoute(points.slice(0, maxIndex + 1), tolerance);
    const right = simplifyRoute(points.slice(maxIndex), tolerance);
    return left.slice(0, -1).concat(right);
  }

  return [firstPoint, lastPoint];
}

/**
 * Calculate perpendicular distance from point to line
 */
function perpendicularDistance(point: Coordinate, lineStart: Coordinate, lineEnd: Coordinate): number {
  // Calculate distances
  const d1 = calculateDistance(point, lineStart);
  const d2 = calculateDistance(point, lineEnd);
  const lineLength = calculateDistance(lineStart, lineEnd);

  if (lineLength === 0) return d1;

  // Heron's formula for area of triangle
  const s = (d1 + d2 + lineLength) / 2;
  const area = Math.sqrt(Math.max(0, s * (s - d1) * (s - d2) * (s - lineLength)));

  return (2 * area) / lineLength;
}

/**
 * Calculate bounding box for a set of coordinates
 */
export function calculateBoundingBox(coordinates: Coordinate[]): {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
} | null {
  if (coordinates.length === 0) return null;

  let minLat = coordinates[0].latitude;
  let maxLat = coordinates[0].latitude;
  let minLng = coordinates[0].longitude;
  let maxLng = coordinates[0].longitude;

  for (const coord of coordinates) {
    if (coord.latitude < minLat) minLat = coord.latitude;
    if (coord.latitude > maxLat) maxLat = coord.latitude;
    if (coord.longitude < minLng) minLng = coord.longitude;
    if (coord.longitude > maxLng) maxLng = coord.longitude;
  }

  return { minLat, maxLat, minLng, maxLng };
}

/**
 * Calculate center point of coordinates
 */
export function calculateCenter(coordinates: Coordinate[]): Coordinate | null {
  if (coordinates.length === 0) return null;

  let totalLat = 0;
  let totalLng = 0;

  for (const coord of coordinates) {
    totalLat += coord.latitude;
    totalLng += coord.longitude;
  }

  return {
    latitude: totalLat / coordinates.length,
    longitude: totalLng / coordinates.length,
  };
}

/**
 * Check if a point is within a certain distance of another point
 */
export function isWithinDistance(
  point1: Coordinate,
  point2: Coordinate,
  distanceMeters: number
): boolean {
  return calculateDistance(point1, point2) <= distanceMeters;
}

/**
 * Convert meters per second to km/h
 */
export function mpsToKmh(mps: number): number {
  return mps * 3.6;
}

/**
 * Convert km/h to meters per second
 */
export function kmhToMps(kmh: number): number {
  return kmh / 3.6;
}

/**
 * Convert meters per second to miles per hour
 */
export function mpsToMph(mps: number): number {
  return mps * 2.23694;
}

/**
 * Parse route data from JSON string
 */
export function parseRouteData(routeData: string | null): Coordinate[] {
  if (!routeData) return [];

  try {
    const parsed = JSON.parse(routeData);
    if (Array.isArray(parsed)) {
      return parsed.map((point: any) => ({
        latitude: point.lat || point.latitude,
        longitude: point.lng || point.longitude,
      }));
    }
    return [];
  } catch (error) {
    console.error('[GeoCalc] Error parsing route data:', error);
    return [];
  }
}

/**
 * Stringify route data for storage
 */
export function stringifyRouteData(coordinates: Coordinate[]): string {
  const simplified = coordinates.map((coord) => ({
    lat: Number(coord.latitude.toFixed(6)),
    lng: Number(coord.longitude.toFixed(6)),
  }));
  return JSON.stringify(simplified);
}

/**
 * Calculate the maximum distance from the starting point reached during a trip
 * This is the primary metric for detecting GPS drift vs real movement
 *
 * @param coordinates - Array of coordinates (first point is start)
 * @returns Maximum distance in meters from start point
 */
export function calculateMaxDistanceFromStart(coordinates: Coordinate[]): number {
  if (coordinates.length < 2) return 0;

  const startPoint = coordinates[0];
  let maxDistance = 0;

  for (const coord of coordinates) {
    const dist = calculateDistance(startPoint, coord);
    if (dist > maxDistance) {
      maxDistance = dist;
    }
  }

  return maxDistance;
}

/**
 * Calculate the radius of gyration for a set of coordinates
 * Measures how spread out the points are from their center of mass
 * Low values indicate clustered points (possible GPS drift)
 *
 * @param coordinates - Array of coordinates
 * @returns Radius of gyration in meters
 */
export function calculateRadiusOfGyration(coordinates: Coordinate[]): number {
  const center = calculateCenter(coordinates);
  if (!center || coordinates.length === 0) return 0;

  let sumSquaredDistances = 0;
  for (const coord of coordinates) {
    const dist = calculateDistance(coord, center);
    sumSquaredDistances += dist * dist;
  }

  return Math.sqrt(sumSquaredDistances / coordinates.length);
}

/**
 * Calculate the dimensions of a bounding box in meters
 *
 * @param coordinates - Array of coordinates
 * @returns Object with width and height in meters, or null if insufficient points
 */
export function calculateBoundingBoxDimensions(coordinates: Coordinate[]): { width: number; height: number } | null {
  const box = calculateBoundingBox(coordinates);
  if (!box) return null;

  const width = calculateDistance(
    { latitude: box.minLat, longitude: box.minLng },
    { latitude: box.minLat, longitude: box.maxLng }
  );
  const height = calculateDistance(
    { latitude: box.minLat, longitude: box.minLng },
    { latitude: box.maxLat, longitude: box.minLng }
  );

  return { width, height };
}
