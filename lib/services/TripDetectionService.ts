/**
 * Trip Detection Service
 *
 * Automatically detects when trips should start and stop based on movement patterns.
 */

import { ActivityClassifier } from './ActivityClassifier';

export interface DetectionConfig {
  stationarySpeedThreshold: number; // m/s - below this is considered stationary
  stationaryTimeThreshold: number;  // seconds - how long to be stationary before ending trip
  stationaryDistanceThreshold: number; // meters - max movement while stationary
  minTripDuration: number; // seconds - minimum duration to save a trip
  minTripDistance: number; // meters - minimum distance to save a trip
  movementSpeedThreshold: number; // m/s - above this starts a new trip
}

export class TripDetectionService {
  private static config: DetectionConfig = {
    stationarySpeedThreshold: 0.5,    // ~1.8 km/h
    stationaryTimeThreshold: 180,      // 3 minutes
    stationaryDistanceThreshold: 50,   // 50 meters
    minTripDuration: 60,               // 1 minute
    minTripDistance: 100,              // 100 meters
    movementSpeedThreshold: 1.0,       // ~3.6 km/h
  };

  /**
   * Check if current state indicates user is stationary
   */
  static isStationary(
    currentSpeed: number,
    lastStationaryTime: number | null,
    currentTime: number
  ): boolean {
    // Check speed threshold
    if (currentSpeed > this.config.stationarySpeedThreshold) {
      return false;
    }

    // If just became stationary, not yet confirmed
    if (!lastStationaryTime) {
      return false;
    }

    // Check if stationary for long enough
    const stationaryDuration = (currentTime - lastStationaryTime) / 1000;
    return stationaryDuration >= this.config.stationaryTimeThreshold;
  }

  /**
   * Check if user just started being stationary
   */
  static justBecameStationary(currentSpeed: number): boolean {
    return currentSpeed <= this.config.stationarySpeedThreshold;
  }

  /**
   * Should we end the current trip?
   */
  static shouldEndTrip(
    tripStartTime: number,
    tripDistance: number,
    lastStationaryTime: number | null,
    currentTime: number
  ): boolean {
    // Don't end if trip is too short in time
    const tripDuration = (currentTime - tripStartTime) / 1000;
    if (tripDuration < this.config.minTripDuration) {
      return false;
    }

    // Don't end if trip is too short in distance
    if (tripDistance < this.config.minTripDistance) {
      return false;
    }

    // End if been stationary for threshold time
    if (lastStationaryTime) {
      const stationaryDuration = (currentTime - lastStationaryTime) / 1000;
      return stationaryDuration >= this.config.stationaryTimeThreshold;
    }

    return false;
  }

  /**
   * Should we start a new trip?
   */
  static shouldStartTrip(currentSpeed: number): boolean {
    // Must be moving faster than threshold
    if (currentSpeed < this.config.movementSpeedThreshold) {
      return false;
    }

    // Classify activity - don't start trip for stationary
    const classification = ActivityClassifier.classifyBySpeed(currentSpeed);
    if (classification.type === 'stationary') {
      return false;
    }

    // Only start for walking, running, cycling (not driving for now)
    const validTypes = ['walking', 'running', 'cycling'];
    return validTypes.includes(classification.type);
  }

  /**
   * Should we discard this trip? (too short or insignificant)
   */
  static shouldDiscardTrip(tripDuration: number, tripDistance: number): boolean {
    return (
      tripDuration < this.config.minTripDuration ||
      tripDistance < this.config.minTripDistance
    );
  }

  /**
   * Update detection configuration
   */
  static setConfig(config: Partial<DetectionConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * Get current configuration
   */
  static getConfig(): DetectionConfig {
    return { ...this.config };
  }

  /**
   * Reset to default configuration
   */
  static resetConfig(): void {
    this.config = {
      stationarySpeedThreshold: 0.5,
      stationaryTimeThreshold: 180,
      stationaryDistanceThreshold: 50,
      minTripDuration: 60,
      minTripDistance: 100,
      movementSpeedThreshold: 1.0,
    };
  }

  /**
   * Get human-readable explanation of current thresholds
   */
  static getConfigExplanation(): string {
    return `
Trip Detection Settings:
- Stationary Speed: < ${(this.config.stationarySpeedThreshold * 3.6).toFixed(1)} km/h
- Stationary Time: ${this.config.stationaryTimeThreshold}s before ending trip
- Movement Speed: > ${(this.config.movementSpeedThreshold * 3.6).toFixed(1)} km/h to start trip
- Minimum Trip: ${this.config.minTripDuration}s and ${this.config.minTripDistance}m
    `.trim();
  }
}
