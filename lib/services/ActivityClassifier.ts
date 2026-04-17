/**
 * Activity Classifier — speed-based fallback.
 *
 * Canonical activity detection now lives in
 * `lib/activity/classifier.ts` (XGBoost on IMU windows) and
 * `lib/services/MLSegmentDetector.ts` (post-hoc segmentation over stored
 * activity_windows). This module is only used when ML data is unavailable
 * (e.g. background-only trips on iOS where `expo-sensors` can't stream),
 * and is intentionally minimal: `classifyBySpeed` + small aggregation.
 *
 * Older heuristics — speed-distribution classification, sinuosity/bearing
 * pattern analysis, and the "possible transit" detector — have been removed.
 * If you need to restore them, do it as a post-processing pass on the ML
 * output, not as a parallel classifier.
 */

export type ActivityType = 'stationary' | 'walking' | 'running' | 'cycling' | 'driving';

export interface ActivityClassification {
  type: ActivityType;
  confidence: number; // 0-100
}

export interface ActivityThresholds {
  stationary: number; // km/h
  walking: number;    // km/h
  running: number;    // km/h (unused — running is merged into cycling for this fallback)
  cycling: number;    // km/h
}

export class ActivityClassifier {
  // Speed thresholds in km/h. Kept loose since this is only a fallback when
  // no IMU data is available. The ML classifier uses a richer feature set
  // and its own thresholds.
  private static thresholds: ActivityThresholds = {
    stationary: 2,
    walking: 7,
    running: 7,
    cycling: 30,
  };

  /**
   * Classify activity based on an instantaneous speed (m/s).
   */
  static classifyBySpeed(speedMps: number): ActivityClassification {
    const speedKmh = speedMps * 3.6;

    if (speedKmh < this.thresholds.stationary) {
      return {
        type: 'stationary',
        confidence: speedKmh < 0.5 ? 95 : 85,
      };
    }

    if (speedKmh < this.thresholds.walking) {
      const midRange = (this.thresholds.stationary + this.thresholds.walking) / 2;
      const distance = Math.abs(speedKmh - midRange);
      const confidence = Math.max(65, 80 - distance * 3);
      return { type: 'walking', confidence: Math.round(confidence) };
    }

    if (speedKmh < this.thresholds.cycling) {
      const midRange = (this.thresholds.walking + this.thresholds.cycling) / 2;
      const distance = Math.abs(speedKmh - midRange);
      const confidence = Math.max(70, 85 - distance * 1.5);
      return { type: 'cycling', confidence: Math.round(confidence) };
    }

    return {
      type: 'driving',
      confidence: speedKmh > 40 ? 95 : 85,
    };
  }

  /**
   * Classify based on a trailing window of speeds in m/s.
   */
  static classifyByMovingAverage(
    speeds: number[],
    windowSize: number = 5,
  ): ActivityClassification {
    if (speeds.length === 0) {
      return { type: 'stationary', confidence: 50 };
    }

    const recentSpeeds = speeds.slice(-windowSize);
    const avgSpeed = recentSpeeds.reduce((a, b) => a + b, 0) / recentSpeeds.length;
    const classification = this.classifyBySpeed(avgSpeed);

    const stdDev = std(recentSpeeds);
    if (stdDev < 2) {
      classification.confidence = Math.min(95, classification.confidence + 10);
    }
    return classification;
  }

  /**
   * Get the dominant activity from a series of per-point classifications,
   * weighted by simple counts. Used by the fallback segmenter.
   */
  static getDominantActivity(
    classifications: ActivityClassification[],
  ): ActivityClassification {
    if (classifications.length === 0) {
      return { type: 'walking', confidence: 0 };
    }

    const counts: Record<ActivityType, number> = {
      stationary: 0, walking: 0, running: 0, cycling: 0, driving: 0,
    };
    const totalConfidence: Record<ActivityType, number> = {
      stationary: 0, walking: 0, running: 0, cycling: 0, driving: 0,
    };

    for (const c of classifications) {
      counts[c.type]++;
      totalConfidence[c.type] += c.confidence;
    }

    let maxCount = 0;
    let dominantType: ActivityType = 'walking';
    for (const [type, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        dominantType = type as ActivityType;
      }
    }

    const avgConfidence =
      maxCount > 0 ? Math.round(totalConfidence[dominantType] / maxCount) : 0;
    return { type: dominantType, confidence: avgConfidence };
  }

  static setThresholds(thresholds: Partial<ActivityThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  static getThresholds(): ActivityThresholds {
    return { ...this.thresholds };
  }

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

function std(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) * (v - mean), 0) / values.length;
  return Math.sqrt(variance);
}
