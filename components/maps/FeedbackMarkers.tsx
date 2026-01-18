/**
 * FeedbackMarkers Component
 * Displays feedback markers on the map using Mapbox layers
 */

import React, { useMemo } from 'react';
import { ShapeSource, CircleLayer } from '@rnmapbox/maps';
import type { MapFeedback } from '@/lib/api/mapFeedback';
import type { GlobalFeedback } from '@/lib/api/globalFeedback';
import { convertFeedbackToGeoJSON } from '@/lib/utils/feedbackHelpers';

interface FeedbackMarkersProps {
  feedbacks?: Array<MapFeedback | GlobalFeedback>;
  type: 'personal' | 'community';
  onMarkerPress?: (feedback: MapFeedback | GlobalFeedback) => void;
}

export function FeedbackMarkers({ feedbacks, type, onMarkerPress }: FeedbackMarkersProps) {
  // Convert feedback to GeoJSON FeatureCollection
  const geojson = useMemo(() => {
    if (!feedbacks || feedbacks.length === 0) {
      return {
        type: 'FeatureCollection' as const,
        features: [],
      };
    }

    return convertFeedbackToGeoJSON(feedbacks);
  }, [feedbacks]);

  // Handle marker press
  const handlePress = (event: any) => {
    if (!onMarkerPress || !feedbacks) return;

    const { features } = event;
    if (features && features.length > 0) {
      const featureIndex = features[0].id;
      const feedback = feedbacks[featureIndex];
      if (feedback) {
        onMarkerPress(feedback);
      }
    }
  };

  // Don't render if no feedback
  if (!feedbacks || feedbacks.length === 0) {
    return null;
  }

  return (
    <ShapeSource
      id={`feedback-source-${type}`}
      shape={geojson}
      onPress={handlePress}
    >
      <CircleLayer
        id={`feedback-circles-${type}`}
        style={{
          // Category-based colors
          circleColor: [
            'match',
            ['get', 'category'],
            'road_damage', '#EF4444',
            'traffic_light', '#F59E0B',
            'safety_issue', '#F97316',
            '#6B7280' // default (other)
          ],
          // Confidence-based radius (for community) or fixed (for personal)
          circleRadius: type === 'community'
            ? [
                'match',
                ['get', 'confidence_level'],
                'high', 10,
                'medium', 8,
                6 // low
              ]
            : 8,
          // Confidence-based opacity (for community) or fixed (for personal)
          circleOpacity: type === 'community'
            ? [
                'match',
                ['get', 'confidence_level'],
                'high', 0.9,
                'medium', 0.7,
                0.5 // low
              ]
            : 0.8,
          circleStrokeWidth: 2,
          circleStrokeColor: '#FFFFFF',
          circleStrokeOpacity: 1,
        }}
      />
    </ShapeSource>
  );
}
