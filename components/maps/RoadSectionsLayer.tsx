/**
 * RoadSectionsLayer Component
 * Displays road sections as colored lines based on ratings
 */

import React, { useMemo } from 'react';
import { ShapeSource, LineLayer } from '@rnmapbox/maps';
import type { RoadSectionPersonal, RoadSectionCommunity } from '@/lib/api/roadSections';

interface RoadSectionsLayerProps {
  sections?: Array<RoadSectionPersonal | RoadSectionCommunity>;
  type: 'personal' | 'global';
  onSectionPress?: (section: RoadSectionPersonal | RoadSectionCommunity) => void;
}

/**
 * Convert road sections to GeoJSON FeatureCollection
 */
function convertToGeoJSON(
  sections: Array<RoadSectionPersonal | RoadSectionCommunity>
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: sections.map((section, index) => {
      // Determine score for color interpolation
      const score = 'community_score' in section
        ? section.community_score
        : section.rating;

      const ratingCount = 'rating_count' in section
        ? section.rating_count
        : 1;

      return {
        type: 'Feature' as const,
        id: index,
        properties: {
          section_id: section.section_id,
          score,
          rating_count: ratingCount,
          type: 'community_score' in section ? 'community' : 'personal',
        },
        geometry: section.geometry,
      };
    }),
  };
}

export function RoadSectionsLayer({ sections, type, onSectionPress }: RoadSectionsLayerProps) {
  // Convert sections to GeoJSON FeatureCollection
  const geojson = useMemo(() => {
    if (!sections || sections.length === 0) {
      return {
        type: 'FeatureCollection' as const,
        features: [],
      };
    }

    return convertToGeoJSON(sections);
  }, [sections]);

  // Handle line press
  const handlePress = (event: any) => {
    if (!onSectionPress || !sections) return;

    const { features } = event;
    if (features && features.length > 0) {
      const featureIndex = features[0].id;
      const section = sections[featureIndex];
      if (section) {
        onSectionPress(section);
      }
    }
  };

  // Don't render if no sections
  if (!sections || sections.length === 0) {
    return null;
  }

  return (
    <ShapeSource
      id={`road-sections-source-${type}`}
      shape={geojson}
      onPress={handlePress}
    >
      <LineLayer
        id={`road-sections-lines-${type}`}
        style={{
          // Interpolate color based on score (1-4)
          // Red (stressed) -> Orange -> Yellow-Green -> Green (enjoyable)
          lineColor: [
            'interpolate',
            ['linear'],
            ['get', 'score'],
            1, '#EF4444',  // Red - Stressed
            2, '#F97316',  // Orange - Uncomfortable
            3, '#84CC16',  // Yellow-Green - Comfortable
            4, '#22C55E',  // Green - Enjoyable
          ],
          // Line width varies by rating count for community (more ratings = thicker)
          lineWidth: type === 'global'
            ? [
                'interpolate',
                ['linear'],
                ['get', 'rating_count'],
                1, 3,   // 1 rating = thin
                5, 4,   // 5 ratings = medium
                10, 6,  // 10+ ratings = thick
              ]
            : 4,
          lineOpacity: 0.85,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />
    </ShapeSource>
  );
}
