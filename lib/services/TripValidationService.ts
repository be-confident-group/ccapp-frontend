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
  trimStationaryTail,
  type Coordinate,
} from '../utils/geoCalculations';
import { database } from '../database';
import type { Trip } from '../database/db';
import { getTrackingConfig } from './TrackingConfig';

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

  /**
   * Validate a trip and update its status in the database.
   *
   * Runs all quality checks (distance thresholds, unsupported type,
   * max speed, GPS drift) and then either cancels the trip or marks
   * it completed with route_data built from its location points.
   *
   * @param tripId - Local trip ID
   * @param endTime - Timestamp (ms) to record as end_time
   * @param additionalFields - Extra fields to merge into the completed-trip update
   *   (e.g. distance, avg_speed, etc. from the caller's stats computation)
   * @returns { isValid, reason }
   */
  static async validateAndFinalizeTrip(
    tripId: string,
    endTime: number,
    additionalFields?: Partial<Trip>
  ): Promise<{ isValid: boolean; reason?: string }> {
    const MIN_WALK_DISTANCE = 400;   // meters
    const MIN_RIDE_DISTANCE = 1000;  // meters
    const MAX_SPEED_KMH = 30;        // km/h

    const trip = await database.getTrip(tripId);
    if (!trip) {
      return { isValid: false, reason: 'Trip not found' };
    }

    let coords: Coordinate[] = [];
    let routeForSync: any[] = [];

    // Prioritize pre-computed route_data from the Native Swift engine or sub-trip splitter
    if (trip.route_data) {
      try {
        routeForSync = JSON.parse(trip.route_data);
        coords = routeForSync.map((p: any) => ({
          latitude: p.lat ?? p.latitude,
          longitude: p.lng ?? p.longitude,
        }));
      } catch (err) {
        console.error(`[TripValidation] Failed to parse existing route_data for ${tripId}`, err);
      }
    }

    // Fallback: If no route_data exists (e.g., legacy engine), query raw locations
    if (coords.length === 0) {
      const locations = await database.getLocationsByTrip(tripId);
      coords = locations.map(loc => ({
        latitude: loc.latitude,
        longitude: loc.longitude,
      }));

      // Build route_data from location points
      routeForSync = locations.map(loc => ({
        lat: Number(loc.latitude.toFixed(6)),
        lng: Number(loc.longitude.toFixed(6)),
        timestamp: new Date(loc.timestamp).toISOString(),
        ...(loc.accuracy != null ? { accuracy: Math.round(loc.accuracy) } : {}),
      }));
    }

    // Trim the trailing stationary tail (GPS drift after arrival kept alive by
    // motion flapping). Adjusts end_time/distance/duration to the real journey.
    let effectiveEndTime = endTime;
    let trimmedStats: { distance: number; duration: number } | null = null;
    const hasTimestamps = routeForSync.length >= 3 && routeForSync.every((p: any) => p.timestamp != null);
    if (hasTimestamps) {
      const trimmed = trimStationaryTail(routeForSync as { lat: number; lng: number; timestamp: string | number }[]);
      if (trimmed.length >= 2 && trimmed.length < routeForSync.length) {
        const lastTs = typeof trimmed[trimmed.length - 1].timestamp === 'number'
          ? (trimmed[trimmed.length - 1].timestamp as number)
          : Date.parse(trimmed[trimmed.length - 1].timestamp as string);
        if (isFinite(lastTs) && lastTs > trip.start_time) {
          console.log(
            `[TripValidation] Trimmed stationary tail: ${routeForSync.length - trimmed.length} points, ` +
            `${Math.round((endTime - lastTs) / 60000)} min`
          );
          routeForSync = trimmed;
          coords = trimmed.map((p: any) => ({
            latitude: p.lat ?? p.latitude,
            longitude: p.lng ?? p.longitude,
          }));
          effectiveEndTime = lastTs;
          let trimmedDistance = 0;
          for (let i = 1; i < coords.length; i++) {
            trimmedDistance += calculateDistance(coords[i - 1], coords[i]);
          }
          trimmedStats = {
            distance: Math.round(trimmedDistance),
            duration: Math.round((lastTs - trip.start_time) / 1000),
          };
        }
      }
    }

    const tripType = trip.type;
    const totalDistance = trimmedStats?.distance ?? trip.distance;
    const maxSpeedKmh = trip.max_speed;
    const locationCount = coords.length;

    // The backend is the single authority on `is_valid` — it recomputes distance/speed
    // from the synced route and applies the same thresholds, but it KEEPS the row
    // (visible under "show flagged", excluded from stats). The frontend must therefore
    // NOT cancel a recorded trip on these heuristics: cancelling sets status='cancelled',
    // which hides the trip from every list AND prevents it from ever syncing, so the user
    // permanently loses a real walk. We record any quality concern as a diagnostic note
    // (surfaced in the Beta Diagnostics drawer) and let the trip sync.
    const diagnostics: string[] = [];

    if (maxSpeedKmh > MAX_SPEED_KMH) {
      diagnostics.push(`Max speed (${maxSpeedKmh.toFixed(1)} km/h) exceeds ${MAX_SPEED_KMH} km/h — backend may reclassify as drive`);
    }
    if (tripType === 'walk' && totalDistance < MIN_WALK_DISTANCE) {
      diagnostics.push(`Walk distance (${totalDistance.toFixed(0)}m) below ${MIN_WALK_DISTANCE}m`);
    }
    if (tripType === 'cycle' && totalDistance < MIN_RIDE_DISTANCE) {
      diagnostics.push(`Ride distance (${totalDistance.toFixed(0)}m) below ${MIN_RIDE_DISTANCE}m`);
    }
    if (coords.length >= 2) {
      const driftResult = this.validateTrip(coords, totalDistance);
      if (!driftResult.isValid) {
        diagnostics.push(`GPS quality: ${driftResult.reasons.join('; ')}`);
      }
    }

    // The ONLY locally-fatal case: a genuinely GPS-starved trip with ~zero usable data
    // (every fix dropped by the accuracy gate, native engine crash, etc.). This mirrors
    // the backend's "minimum size rejection" floor so we never sync pure noise, while
    // still letting every real trip through.
    const cfg = getTrackingConfig();
    if (totalDistance < cfg.minTripDistanceM && locationCount < cfg.minTripLocationCount) {
      const reason = `GPS-starved trip (${totalDistance.toFixed(0)}m, ${locationCount} points)`;
      console.log(`[TripValidation] Trip ${tripId} discarded: ${reason}`);
      await database.updateTrip(tripId, {
        status: 'cancelled',
        end_time: endTime,
        notes: reason,
        updated_at: endTime,
      });
      return { isValid: false, reason };
    }

    const note = diagnostics.length > 0 ? diagnostics.join('; ') : undefined;

    // Pedometer cross-check: a walk with significant duration but <100 steps is GPS drift,
    // not real movement. A cycle with walking-cadence steps is likely mislabeled.
    // These rules use only platform sensor data — no ML, no speed thresholds.
    if (trip.step_count != null && trip.step_count >= 0) {
      const durationMin = (totalDistance > 0 ? (endTime - trip.start_time) / 60000 : 0);
      const stepRate = durationMin > 0 ? trip.step_count / durationMin : 0;

      if (tripType === 'walk' && durationMin >= 5 && trip.step_count < 100) {
        // Long walk duration but almost no steps — high confidence this is GPS drift.
        diagnostics.push(`Pedometer: walk ${durationMin.toFixed(0)}min but only ${trip.step_count} steps — likely GPS drift`);
      } else if (tripType === 'cycle' && durationMin >= 3 && stepRate > 80) {
        // Cycling cadence of >80 steps/min sustained means the user was walking, not cycling.
        // Don't auto-flip — leave visible so the user can confirm.
        diagnostics.push(`Pedometer: cycle typed but walking cadence (~${stepRate.toFixed(0)} steps/min) — please confirm activity type`);
      }
    }

    // Trips below the per-type distance minimum are kept in the DB (so they sync and
    // appear in diagnostics) but hidden from all user-facing lists via visible=0.
    // GPS-quality-only issues (e.g. loop walks) are flagged in notes but remain visible.
    const isHidden = diagnostics.some(d =>
      d.includes('Walk distance') || d.includes('Ride distance') ||
      d.includes('Pedometer: walk') // drift confirmed by step count — hide these
    );

    console.log(
      `[TripValidation] Trip ${tripId} kept (visible=${isHidden ? 0 : 1}) — ${routeForSync.length} points` +
      (note ? ` (flagged: ${note})` : '')
    );

    await database.updateTrip(tripId, {
      status: 'completed',
      end_time: effectiveEndTime,
      route_data: JSON.stringify(routeForSync),
      updated_at: endTime,
      visible: isHidden ? 0 : 1,
      ...(note ? { notes: note } : {}),
      ...additionalFields,
      // Tail-trim wins over caller-supplied stats: it reflects the real journey end.
      ...(trimmedStats ? trimmedStats : {}),
    });

    return { isValid: !isHidden, reason: isHidden ? note : undefined };
  }
}
