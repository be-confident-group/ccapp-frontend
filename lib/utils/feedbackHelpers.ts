import type { MapFeedback, MapFeedbackCategory } from '@/lib/api/mapFeedback';
import type { GlobalFeedback, ConfidenceLevel } from '@/lib/api/globalFeedback';

/**
 * Convert feedback array to GeoJSON FeatureCollection
 */
export function convertFeedbackToGeoJSON(
  feedbacks: Array<MapFeedback | GlobalFeedback>
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: feedbacks.map((feedback, index) => {
      const geometry = 'coordinates' in feedback
        ? feedback.coordinates
        : feedback.representative_geometry;

      const confidenceLevel: ConfidenceLevel =
        'confidence_level' in feedback ? feedback.confidence_level : 'high';

      const properties: Record<string, any> = {
        id: feedback.id,
        category: feedback.category,
        confidence_level: confidenceLevel,
      };

      // Add type-specific properties
      if ('title' in feedback) {
        properties.title = feedback.title;
        properties.description = feedback.description;
        properties.type = 'personal';
      } else {
        properties.confidence_score = feedback.confidence_score;
        properties.signal_strength = feedback.signal_strength;
        properties.type = 'community';
      }

      return {
        type: 'Feature' as const,
        id: index,
        properties,
        geometry,
      };
    }),
  };
}

/**
 * Get color hex code for a feedback category
 */
export function getCategoryColor(category: MapFeedbackCategory): string {
  const colors: Record<MapFeedbackCategory, string> = {
    road_damage: '#EF4444', // Red
    traffic_light: '#F59E0B', // Amber
    safety_issue: '#F97316', // Orange
    other: '#6B7280', // Gray
  };

  return colors[category] || colors.other;
}

/**
 * Get icon/emoji for a feedback category
 */
export function getCategoryIcon(category: MapFeedbackCategory): string {
  const icons: Record<MapFeedbackCategory, string> = {
    road_damage: '🚧',
    traffic_light: '🚦',
    safety_issue: '⚠️',
    other: '📍',
  };

  return icons[category] || icons.other;
}

/**
 * Get marker radius based on confidence level
 */
export function getConfidenceRadius(confidenceLevel: ConfidenceLevel): number {
  const radii: Record<ConfidenceLevel, number> = {
    high: 10,
    medium: 8,
    low: 6,
  };

  return radii[confidenceLevel];
}

/**
 * Get marker opacity based on confidence level
 */
export function getConfidenceOpacity(confidenceLevel: ConfidenceLevel): number {
  const opacities: Record<ConfidenceLevel, number> = {
    high: 0.9,
    medium: 0.7,
    low: 0.5,
  };

  return opacities[confidenceLevel];
}

/**
 * Debounce function to limit execution rate
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(later, wait);
  };
}

/**
 * Parse bbox string to object
 */
interface BboxBounds {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
  width: number;
  height: number;
}

export function parseBbox(bbox: string): BboxBounds {
  const [minLon, minLat, maxLon, maxLat] = bbox.split(',').map(Number);

  return {
    minLon,
    minLat,
    maxLon,
    maxLat,
    width: maxLon - minLon,
    height: maxLat - minLat,
  };
}

/**
 * Check if bbox changed significantly (more than threshold)
 */
export function shouldRefetchForBbox(
  oldBbox: string | undefined,
  newBbox: string,
  threshold: number = 0.2
): boolean {
  if (!oldBbox) return true;

  try {
    const oldBounds = parseBbox(oldBbox);
    const newBounds = parseBbox(newBbox);

    const widthChange = Math.abs(newBounds.width - oldBounds.width) / oldBounds.width;
    const heightChange = Math.abs(newBounds.height - oldBounds.height) / oldBounds.height;

    return widthChange > threshold || heightChange > threshold;
  } catch (error) {
    console.error('[FeedbackHelpers] Error comparing bboxes:', error);
    return true; // Refetch on error
  }
}
