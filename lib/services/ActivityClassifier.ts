/**
 * Activity Classifier
 *
 * Classifies activity type based on speed and movement patterns.
 * Uses speed-based algorithm with configurable thresholds.
 * Enhanced with speed distribution analysis for better accuracy.
 */

export type ActivityType = 'stationary' | 'walking' | 'running' | 'cycling' | 'driving';

// Extended type to include transit detection
export type ExtendedActivityType = ActivityType | 'transit';

export interface ActivityClassification {
  type: ActivityType;
  confidence: number; // 0-100
  possibleTransit?: boolean; // Flag if this might be transit (train/bus)
}

export interface ActivityThresholds {
  stationary: number;  // km/h
  walking: number;     // km/h
  running: number;     // km/h
  cycling: number;     // km/h
}

export interface SpeedDistributionMetrics {
  median: number;
  mean: number;
  p25: number;
  p75: number;
  iqr: number;        // Interquartile range
  variance: number;
  stdDev: number;
  sustainedHighSpeedRatio: number; // % of readings at 8+ km/h
}

export interface LocationPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  speed?: number; // m/s
}

export class ActivityClassifier {
  // Speed thresholds in km/h
  // Updated thresholds: walk (2-7), ride/cycle (7-30), drive (>30)
  private static thresholds: ActivityThresholds = {
    stationary: 2,   // < 2 km/h
    walking: 7,      // 2-7 km/h
    running: 7,      // Not used (merged with cycling as "ride")
    cycling: 30,     // 7-30 km/h (includes what was running)
    // > 30 km/h = driving
  };

  /**
   * Classify activity based on speed (m/s)
   */
  static classifyBySpeed(speedMps: number): ActivityClassification {
    const speedKmh = speedMps * 3.6; // Convert m/s to km/h

    // Stationary: < 2 km/h
    if (speedKmh < this.thresholds.stationary) {
      return {
        type: 'stationary',
        confidence: speedKmh < 0.5 ? 95 : 85,
      };
    }

    // Walking: 2-7 km/h
    if (speedKmh >= this.thresholds.stationary && speedKmh < this.thresholds.walking) {
      // Higher confidence in middle of range
      const midRange = (this.thresholds.stationary + this.thresholds.walking) / 2;
      const distance = Math.abs(speedKmh - midRange);
      const confidence = Math.max(65, 80 - distance * 3);

      return {
        type: 'walking',
        confidence: Math.round(confidence),
      };
    }

    // Cycling/Riding: 7-30 km/h (includes what was previously "running")
    if (speedKmh >= this.thresholds.walking && speedKmh < this.thresholds.cycling) {
      const midRange = (this.thresholds.walking + this.thresholds.cycling) / 2;
      const distance = Math.abs(speedKmh - midRange);
      const confidence = Math.max(70, 85 - distance * 1.5);

      return {
        type: 'cycling',
        confidence: Math.round(confidence),
      };
    }

    // Driving: 30+ km/h (was 40+)
    if (speedKmh >= this.thresholds.cycling) {
      return {
        type: 'driving',
        confidence: speedKmh > 40 ? 95 : 85,
      };
    }

    // Fallback (should not reach here)
    return {
      type: 'walking',
      confidence: 30,
    };
  }

  /**
   * Classify based on moving average of multiple speed readings
   * More accurate than single speed reading
   */
  static classifyByMovingAverage(
    speeds: number[],
    windowSize: number = 5
  ): ActivityClassification {
    if (speeds.length === 0) {
      return { type: 'stationary', confidence: 50 };
    }

    // Take last N speeds
    const recentSpeeds = speeds.slice(-windowSize);
    const avgSpeed = recentSpeeds.reduce((a, b) => a + b, 0) / recentSpeeds.length;

    // Boost confidence for consistent speeds
    const classification = this.classifyBySpeed(avgSpeed);

    // Check speed consistency
    const variance = this.calculateVariance(recentSpeeds);
    const isConsistent = variance < 2; // Low variance = consistent speed

    if (isConsistent) {
      classification.confidence = Math.min(95, classification.confidence + 10);
    }

    return classification;
  }

  /**
   * Get the dominant activity from a series of classifications
   */
  static getDominantActivity(
    classifications: ActivityClassification[]
  ): ActivityClassification {
    if (classifications.length === 0) {
      return { type: 'walking', confidence: 0 };
    }

    // Count occurrences of each activity type
    const counts: Record<ActivityType, number> = {
      stationary: 0,
      walking: 0,
      running: 0,
      cycling: 0,
      driving: 0,
    };

    const totalConfidence: Record<ActivityType, number> = {
      stationary: 0,
      walking: 0,
      running: 0,
      cycling: 0,
      driving: 0,
    };

    for (const classification of classifications) {
      counts[classification.type]++;
      totalConfidence[classification.type] += classification.confidence;
    }

    // Find activity with highest count
    let maxCount = 0;
    let dominantType: ActivityType = 'walking';

    for (const [type, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        dominantType = type as ActivityType;
      }
    }

    // Calculate average confidence for dominant activity
    const avgConfidence =
      maxCount > 0 ? Math.round(totalConfidence[dominantType] / maxCount) : 0;

    return {
      type: dominantType,
      confidence: avgConfidence,
    };
  }

  /**
   * Update thresholds (for future customization)
   */
  static setThresholds(thresholds: Partial<ActivityThresholds>): void {
    this.thresholds = {
      ...this.thresholds,
      ...thresholds,
    };
  }

  /**
   * Get current thresholds
   */
  static getThresholds(): ActivityThresholds {
    return { ...this.thresholds };
  }

  /**
   * Calculate variance of speed readings
   */
  private static calculateVariance(speeds: number[]): number {
    if (speeds.length === 0) return 0;

    const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    const squaredDiffs = speeds.map((speed) => Math.pow(speed - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / speeds.length;

    return Math.sqrt(variance); // Return standard deviation
  }

  /**
   * Get human-readable activity name
   */
  static getActivityName(type: ActivityType): string {
    const names: Record<ActivityType, string> = {
      stationary: 'Stationary',
      walking: 'Walking',
      running: 'Running',
      cycling: 'Cycling',
      driving: 'Driving',
    };
    return names[type];
  }

  /**
   * Get activity icon name (for UI)
   */
  static getActivityIcon(type: ActivityType): string {
    const icons: Record<ActivityType, string> = {
      stationary: 'pause-circle',
      walking: 'walk',
      running: 'run-fast',
      cycling: 'bicycle',
      driving: 'car',
    };
    return icons[type];
  }

  /**
   * Get activity color (for UI)
   */
  static getActivityColor(type: ActivityType): string {
    const colors: Record<ActivityType, string> = {
      stationary: '#9E9E9E',
      walking: '#4CAF50',
      running: '#FF9800',
      cycling: '#2196F3',
      driving: '#F44336',
    };
    return colors[type];
  }

  // ===== ENHANCED CLASSIFICATION METHODS =====

  /**
   * Calculate speed distribution metrics from an array of speeds
   * @param speeds Array of speeds in km/h
   */
  static calculateSpeedDistribution(speeds: number[]): SpeedDistributionMetrics {
    if (speeds.length === 0) {
      return {
        median: 0,
        mean: 0,
        p25: 0,
        p75: 0,
        iqr: 0,
        variance: 0,
        stdDev: 0,
        sustainedHighSpeedRatio: 0,
      };
    }

    const sorted = [...speeds].sort((a, b) => a - b);
    const n = sorted.length;

    // Calculate percentiles
    const median = sorted[Math.floor(n / 2)];
    const p25 = sorted[Math.floor(n * 0.25)];
    const p75 = sorted[Math.floor(n * 0.75)];
    const iqr = p75 - p25;

    // Calculate mean and variance
    const mean = speeds.reduce((a, b) => a + b, 0) / n;
    const variance = speeds.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);

    // Calculate sustained high speed ratio (7+ km/h - cycling threshold)
    const highSpeedThreshold = 7;
    const highSpeedCount = speeds.filter((s) => s >= highSpeedThreshold).length;
    const sustainedHighSpeedRatio = highSpeedCount / n;

    return {
      median,
      mean,
      p25,
      p75,
      iqr,
      variance,
      stdDev,
      sustainedHighSpeedRatio,
    };
  }

  /**
   * Classify activity using speed distribution analysis
   * More sophisticated than single-speed classification
   * @param speeds Array of speeds in m/s
   * @param windowSize Number of recent speeds to analyze
   */
  static classifyBySpeedDistribution(
    speeds: number[],
    windowSize: number = 10
  ): ActivityClassification {
    if (speeds.length === 0) {
      return { type: 'stationary', confidence: 50 };
    }

    if (speeds.length < windowSize) {
      // Fall back to moving average for small samples
      return this.classifyByMovingAverage(speeds);
    }

    // Take last N speeds and convert to km/h
    const recentSpeeds = speeds.slice(-windowSize);
    const speedsKmh = recentSpeeds.map((s) => s * 3.6);

    const metrics = this.calculateSpeedDistribution(speedsKmh);

    // Use median instead of mean (more robust to outliers)
    const classification = this.classifyBySpeed(metrics.median / 3.6); // Convert back to m/s

    let confidence = classification.confidence;

    // Adjust confidence based on distribution characteristics
    // High IQR (high variance) reduces confidence
    if (metrics.iqr > 5) {
      confidence -= 10;
    }

    // Very consistent speed increases confidence
    if (metrics.iqr < 2 && metrics.variance < 2) {
      confidence += 10;
    }

    // Check for possible transit pattern (train/bus)
    const possibleTransit = this.detectPossibleTransit(metrics);

    return {
      type: classification.type,
      confidence: Math.max(30, Math.min(95, confidence)),
      possibleTransit,
    };
  }

  /**
   * Detect if the speed pattern suggests transit (train/bus) rather than human activity
   * Trains at 8-15 km/h (accelerating/decelerating) can look like running
   */
  private static detectPossibleTransit(metrics: SpeedDistributionMetrics): boolean {
    // Transit indicators:
    // 1. Median speed in "running" range (8-15 km/h)
    // 2. Very low speed variance (trains maintain speed)
    // 3. High sustained speed ratio (trains don't slow down like runners)

    const isInRunningRange = metrics.median >= 8 && metrics.median <= 20;
    const hasLowVariance = metrics.iqr < 3 && metrics.stdDev < 2;
    const hasSustainedSpeed = metrics.sustainedHighSpeedRatio > 0.7;

    // Need at least 2 indicators to flag as possible transit
    const indicators = [isInRunningRange, hasLowVariance, hasSustainedSpeed];
    const indicatorCount = indicators.filter(Boolean).length;

    return indicatorCount >= 2;
  }

  /**
   * Calculate sinuosity (path straightness) from location points
   * Sinuosity = total_path_distance / straight_line_distance
   *
   * - Perfectly straight: 1.0
   * - Train/vehicle: 1.0 - 1.15
   * - Cyclist on road: 1.1 - 1.4
   * - Runner on trail: 1.3 - 2.0
   * - Walker exploring: 1.5 - 3.0+
   */
  static calculateSinuosity(points: LocationPoint[]): number {
    if (points.length < 2) {
      return 1.0;
    }

    // Calculate total path distance
    let totalDistance = 0;
    for (let i = 0; i < points.length - 1; i++) {
      totalDistance += this.haversineDistance(
        points[i].latitude,
        points[i].longitude,
        points[i + 1].latitude,
        points[i + 1].longitude
      );
    }

    // Calculate straight-line distance
    const straightLine = this.haversineDistance(
      points[0].latitude,
      points[0].longitude,
      points[points.length - 1].latitude,
      points[points.length - 1].longitude
    );

    if (straightLine < 50) {
      // Less than 50m straight line - not enough data for meaningful sinuosity
      return 1.0;
    }

    return totalDistance / straightLine;
  }

  /**
   * Count significant bearing (direction) changes
   * Trains: few changes (follow tracks)
   * Runners: many changes (zigzag, turns)
   */
  static countBearingChanges(
    points: LocationPoint[],
    thresholdDegrees: number = 30
  ): number {
    if (points.length < 3) {
      return 0;
    }

    let changes = 0;
    for (let i = 1; i < points.length - 1; i++) {
      const bearing1 = this.calculateBearing(
        points[i - 1].latitude,
        points[i - 1].longitude,
        points[i].latitude,
        points[i].longitude
      );
      const bearing2 = this.calculateBearing(
        points[i].latitude,
        points[i].longitude,
        points[i + 1].latitude,
        points[i + 1].longitude
      );

      let diff = Math.abs(bearing2 - bearing1);
      if (diff > 180) {
        diff = 360 - diff;
      }

      if (diff > thresholdDegrees) {
        changes++;
      }
    }

    return changes;
  }

  /**
   * Enhanced classification that considers movement patterns
   * Use this for more accurate classification after trip completion
   */
  static classifyWithPatterns(
    speeds: number[],
    locations: LocationPoint[]
  ): ActivityClassification {
    // Get basic speed-based classification
    const speedsKmh = speeds.map((s) => s * 3.6);
    const metrics = this.calculateSpeedDistribution(speedsKmh);
    const baseClassification = this.classifyBySpeedDistribution(speeds);

    // Calculate pattern metrics
    const sinuosity = this.calculateSinuosity(locations);
    const bearingChanges = this.countBearingChanges(locations);
    const totalDistanceKm = this.calculateTotalDistance(locations) / 1000;
    const bearingChangesPerKm = totalDistanceKm > 0 ? bearingChanges / totalDistanceKm : 0;

    // Transit detection using pattern analysis
    const isLikelyTransit = this.isLikelyTransit(
      metrics,
      sinuosity,
      bearingChangesPerKm
    );

    if (isLikelyTransit && baseClassification.type === 'running') {
      // Override running classification to driving if transit pattern detected
      // (frontend uses 'driving' since we don't have 'transit' type)
      return {
        type: 'driving',
        confidence: Math.max(60, baseClassification.confidence - 10),
        possibleTransit: true,
      };
    }

    return baseClassification;
  }

  /**
   * Determine if movement pattern suggests transit (train/bus)
   */
  private static isLikelyTransit(
    speedMetrics: SpeedDistributionMetrics,
    sinuosity: number,
    bearingChangesPerKm: number
  ): boolean {
    // Transit criteria (need multiple indicators):
    // 1. Median speed in running/cycling range (8-40 km/h)
    // 2. Low sinuosity (follows tracks/roads)
    // 3. Few bearing changes per km
    // 4. High sustained speed ratio
    // 5. Low speed variance

    let transitIndicators = 0;

    // Speed in transit-like range
    if (speedMetrics.median >= 8 && speedMetrics.median <= 40) {
      transitIndicators++;
    }

    // Very straight path (follows rails/roads)
    if (sinuosity < 1.15) {
      transitIndicators += 2; // Strong indicator
    }

    // Few direction changes
    if (bearingChangesPerKm < 3) {
      transitIndicators += 2; // Strong indicator
    }

    // Sustained high speed
    if (speedMetrics.sustainedHighSpeedRatio > 0.7) {
      transitIndicators++;
    }

    // Low speed variance (mechanical consistency)
    if (speedMetrics.iqr < 3) {
      transitIndicators++;
    }

    // Need 4+ indicators to confidently flag as transit
    return transitIndicators >= 4;
  }

  // ===== GEO CALCULATION HELPERS =====

  /**
   * Haversine distance between two points in meters
   */
  private static haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371000; // Earth radius in meters
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Calculate bearing between two points in degrees
   */
  private static calculateBearing(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const dLon = this.toRadians(lon2 - lon1);
    const lat1Rad = this.toRadians(lat1);
    const lat2Rad = this.toRadians(lat2);

    const x = Math.sin(dLon) * Math.cos(lat2Rad);
    const y =
      Math.cos(lat1Rad) * Math.sin(lat2Rad) -
      Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

    const bearing = Math.atan2(x, y);
    return (this.toDegrees(bearing) + 360) % 360;
  }

  /**
   * Calculate total distance of a path in meters
   */
  private static calculateTotalDistance(points: LocationPoint[]): number {
    if (points.length < 2) return 0;

    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
      total += this.haversineDistance(
        points[i].latitude,
        points[i].longitude,
        points[i + 1].latitude,
        points[i + 1].longitude
      );
    }
    return total;
  }

  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private static toDegrees(radians: number): number {
    return radians * (180 / Math.PI);
  }
}
