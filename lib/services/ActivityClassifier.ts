/**
 * Activity Classifier
 *
 * Classifies activity type based on speed and movement patterns.
 * Uses speed-based algorithm with configurable thresholds.
 */

export type ActivityType = 'stationary' | 'walking' | 'running' | 'cycling' | 'driving';

export interface ActivityClassification {
  type: ActivityType;
  confidence: number; // 0-100
}

export interface ActivityThresholds {
  stationary: number;  // km/h
  walking: number;     // km/h
  running: number;     // km/h
  cycling: number;     // km/h
}

export class ActivityClassifier {
  // Speed thresholds in km/h
  private static thresholds: ActivityThresholds = {
    stationary: 2,   // < 2 km/h
    walking: 8,      // 2-8 km/h
    running: 15,     // 8-15 km/h
    cycling: 40,     // 15-40 km/h
    // > 40 km/h = driving
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

    // Walking: 2-8 km/h
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

    // Running: 8-15 km/h
    if (speedKmh >= this.thresholds.walking && speedKmh < this.thresholds.running) {
      const midRange = (this.thresholds.walking + this.thresholds.running) / 2;
      const distance = Math.abs(speedKmh - midRange);
      const confidence = Math.max(60, 75 - distance * 2);

      return {
        type: 'running',
        confidence: Math.round(confidence),
      };
    }

    // Cycling: 15-40 km/h
    if (speedKmh >= this.thresholds.running && speedKmh < this.thresholds.cycling) {
      const midRange = (this.thresholds.running + this.thresholds.cycling) / 2;
      const distance = Math.abs(speedKmh - midRange);
      const confidence = Math.max(70, 85 - distance * 1.5);

      return {
        type: 'cycling',
        confidence: Math.round(confidence),
      };
    }

    // Driving: 40+ km/h
    if (speedKmh >= this.thresholds.cycling) {
      return {
        type: 'driving',
        confidence: speedKmh > 50 ? 90 : 80,
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
}
