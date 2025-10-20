/**
 * Heatmap types for trip visualization
 */

import type { Coordinate } from './location';
import type { TripType } from './trip';

/**
 * Single point in heatmap with weight
 */
export interface HeatmapPoint {
  coordinate: Coordinate;
  weight: number; // Contribution to heatmap intensity (1-10)
}

/**
 * GeoJSON Feature for heatmap
 */
export interface HeatmapFeature {
  type: 'Feature';
  properties: {
    weight: number;
  };
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
}

/**
 * GeoJSON FeatureCollection for heatmap layer
 */
export interface HeatmapGeoJSON {
  type: 'FeatureCollection';
  features: HeatmapFeature[];
}

/**
 * Heatmap configuration
 */
export interface HeatmapConfig {
  radius: number | any[]; // Radius in pixels or expression
  weight: number | any[]; // Weight expression
  intensity: number | any[]; // Intensity expression
  color: string | any[]; // Color gradient or expression
  opacity: number | any[]; // Opacity or expression
}

/**
 * Heatmap data request parameters
 */
export interface HeatmapDataRequest {
  bounds: {
    northEast: Coordinate;
    southWest: Coordinate;
  };
  startDate?: Date;
  endDate?: Date;
  tripType?: TripType;
  userId?: string; // For personal heatmaps
}

/**
 * Heatmap data response
 */
export interface HeatmapDataResponse {
  points: HeatmapPoint[];
  totalTrips: number;
  dateRange: {
    start: Date;
    end: Date;
  };
}

/**
 * Heatmap mode type
 */
export type HeatmapMode = 'global' | 'personal';

/**
 * Heatmap style preset
 */
export type HeatmapStyle = 'personal' | 'global' | 'custom';

/**
 * Heatmap legend entry
 */
export interface HeatmapLegendEntry {
  label: string;
  color: string;
  minValue: number;
  maxValue: number;
}
