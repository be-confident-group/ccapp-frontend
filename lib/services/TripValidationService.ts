/**
 * Trip Validation Service
 *
 * Validates trips to detect GPS drift and filter out false positive trips.
 * Uses multiple metrics to determine if a trip represents real movement.
 */

import {
  calculateDistance,
  calculateMaxDistanceFromStart,
  calculateRadiusOfGyration,
  calculateBoundingBoxDimensions,
  type Coordinate,
} from '../utils/geoCalculations';

/**
 * Validation metrics calculated for each trip
 */
export interface ValidationMetrics {
  maxDistanceFromStart: number;  // Furthest point from start (meters)
  netDisplacement: number;       // Straight-line start to end (meters)
  displacementRatio: number;     // netDisplacement / totalDistance
  boundingBoxWidth: number;      // Geographic extent width (meters)
  boundingBoxHeight: number;     // Geographic extent height (meters)
  radiusOfGyration: number;      // Spread of points from center (meters)
  totalDistance: number;         // Total distance traveled (meters)
}

/**
 * Result of trip validation
 */
export interface ValidationResult {
  isValid: boolean;
  reasons: string[];
  metrics: ValidationMetrics;
}

/**
 * Configuration for validation thresholds
 */
interface ValidationConfig {
  minMaxDistanceFromStart: number;  // Must reach at least this far from start
  minDisplacementRatioThreshold: number;  // For secondary circular check
  maxDistanceForDisplacementCheck: number;  // Only apply displacement ratio if within this distance
  minBoundingBoxDimension: number;  // Minimum trip extent
  totalDistanceForBoundingBoxCheck: number;  // Only check bounding box if distance exceeds this
  minRadiusOfGyration: number;  // Minimum spread of points
  totalDistanceForGyrationCheck: number;  // Only check gyration if distance exceeds this
}

/**
 * Default validation configuration
 * These thresholds are tunable based on real-world data
 */
const DEFAULT_CONFIG: ValidationConfig = {
  minMaxDistanceFromStart: 150,  // meters - must reach at least this far
  minDisplacementRatioThreshold: 0.10,  // 10% - for circular pattern detection
  maxDistanceForDisplacementCheck: 200,  // Only check displacement ratio if stayed within 200m
  minBoundingBoxDimension: 80,  // meters - trip should cover some area
  totalDistanceForBoundingBoxCheck: 400,  // Only check if claimed distance > 400m
  minRadiusOfGyration: 25,  // meters - points should be spread out
  totalDistanceForGyrationCheck: 300,  // Only check if claimed distance > 300m
};

export class TripValidationService {
  private static config: ValidationConfig = { ...DEFAULT_CONFIG };

  /**
   * Validate a trip based on its coordinates and claimed distance
   *
   * @param coordinates - Array of trip coordinates
   * @param totalDistance - Total distance traveled (meters)
   * @returns Validation result with metrics and reasons
   */
  static validateTrip(coordinates: Coordinate[], totalDistance: number): ValidationResult {
    const reasons: string[] = [];

    // Calculate all metrics
    const metrics = this.calculateMetrics(coordinates, totalDistance);

    // Log metrics for tuning purposes
    console.log(`[TripValidation] Metrics:`, {
      maxDistanceFromStart: metrics.maxDistanceFromStart.toFixed(0),
      netDisplacement: metrics.netDisplacement.toFixed(0),
      displacementRatio: metrics.displacementRatio.toFixed(2),
      boundingBox: `${metrics.boundingBoxWidth.toFixed(0)}x${metrics.boundingBoxHeight.toFixed(0)}`,
      radiusOfGyration: metrics.radiusOfGyration.toFixed(0),
      totalDistance: metrics.totalDistance.toFixed(0),
    });

    // Check 1: Maximum distance from start (PRIMARY CHECK)
    // Trip must reach at least minMaxDistanceFromStart from the starting point
    if (metrics.maxDistanceFromStart < this.config.minMaxDistanceFromStart) {
      reasons.push(
        `Never went far enough from start (${metrics.maxDistanceFromStart.toFixed(0)}m < ${this.config.minMaxDistanceFromStart}m required)`
      );
    }

    // Check 2: Displacement ratio (SECONDARY - only if stayed close to start)
    // If trip stayed within maxDistanceForDisplacementCheck, check for circular patterns
    if (
      metrics.maxDistanceFromStart < this.config.maxDistanceForDisplacementCheck &&
      metrics.displacementRatio < this.config.minDisplacementRatioThreshold
    ) {
      reasons.push(
        `Circular movement pattern detected (displacement ratio ${(metrics.displacementRatio * 100).toFixed(0)}% < ${this.config.minDisplacementRatioThreshold * 100}% required)`
      );
    }

    // Check 3: Bounding box (only for trips claiming significant distance)
    // If claimed distance is high but stayed in small area, likely GPS drift
    if (
      totalDistance > this.config.totalDistanceForBoundingBoxCheck &&
      Math.max(metrics.boundingBoxWidth, metrics.boundingBoxHeight) < this.config.minBoundingBoxDimension
    ) {
      reasons.push(
        `Claimed ${totalDistance.toFixed(0)}m but stayed in ${metrics.boundingBoxWidth.toFixed(0)}x${metrics.boundingBoxHeight.toFixed(0)}m area`
      );
    }

    // Check 4: Radius of gyration (only for trips claiming significant distance)
    // If points are too clustered for the claimed distance, likely GPS drift
    if (
      totalDistance > this.config.totalDistanceForGyrationCheck &&
      metrics.radiusOfGyration < this.config.minRadiusOfGyration
    ) {
      reasons.push(
        `Points too clustered (radius of gyration ${metrics.radiusOfGyration.toFixed(0)}m < ${this.config.minRadiusOfGyration}m for ${totalDistance.toFixed(0)}m trip)`
      );
    }

    const isValid = reasons.length === 0;

    console.log(`[TripValidation] Result: ${isValid ? 'VALID' : 'INVALID'}${reasons.length > 0 ? ` - ${reasons.join('; ')}` : ''}`);

    return {
      isValid,
      reasons,
      metrics,
    };
  }

  /**
   * Calculate all validation metrics for a trip
   */
  private static calculateMetrics(coordinates: Coordinate[], totalDistance: number): ValidationMetrics {
    if (coordinates.length < 2) {
      return {
        maxDistanceFromStart: 0,
        netDisplacement: 0,
        displacementRatio: 0,
        boundingBoxWidth: 0,
        boundingBoxHeight: 0,
        radiusOfGyration: 0,
        totalDistance,
      };
    }

    const startPoint = coordinates[0];
    const endPoint = coordinates[coordinates.length - 1];

    // Calculate metrics
    const maxDistanceFromStart = calculateMaxDistanceFromStart(coordinates);
    const netDisplacement = calculateDistance(startPoint, endPoint);
    const displacementRatio = totalDistance > 0 ? netDisplacement / totalDistance : 0;
    const radiusOfGyration = calculateRadiusOfGyration(coordinates);

    const boxDimensions = calculateBoundingBoxDimensions(coordinates);
    const boundingBoxWidth = boxDimensions?.width ?? 0;
    const boundingBoxHeight = boxDimensions?.height ?? 0;

    return {
      maxDistanceFromStart,
      netDisplacement,
      displacementRatio,
      boundingBoxWidth,
      boundingBoxHeight,
      radiusOfGyration,
      totalDistance,
    };
  }

  /**
   * Update validation configuration
   */
  static setConfig(config: Partial<ValidationConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * Get current configuration
   */
  static getConfig(): ValidationConfig {
    return { ...this.config };
  }

  /**
   * Reset to default configuration
   */
  static resetConfig(): void {
    this.config = { ...DEFAULT_CONFIG };
  }
}
