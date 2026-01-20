/**
 * RoadSectionsLayer Component
 * Displays road sections as colored lines based on ratings
 */

import React, { useMemo, useEffect, useState } from 'react';
import { ShapeSource, LineLayer } from '@rnmapbox/maps';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
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
  const { colors } = useTheme();
  const [showEmptyMessage, setShowEmptyMessage] = useState(false);
  
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

  // Show empty message briefly when no sections are available
  useEffect(() => {
    if (sections !== undefined && sections.length === 0) {
      setShowEmptyMessage(true);
      const timer = setTimeout(() => setShowEmptyMessage(false), 5000);
      return () => clearTimeout(timer);
    } else {
      setShowEmptyMessage(false);
    }
  }, [sections]);

  // Don't render layer if no sections
  if (!sections || sections.length === 0) {
    // Show informational message
    if (showEmptyMessage) {
      return (
        <View style={styles.emptyMessageContainer} pointerEvents="none">
          <View style={[styles.emptyMessage, { backgroundColor: colors.card }]}>
            <Text style={[styles.emptyMessageText, { color: colors.text }]}>
              {type === 'personal' 
                ? 'No personal ratings in this area yet' 
                : 'No community ratings available in this area'}
            </Text>
            <Text style={[styles.emptyMessageSubtext, { color: colors.textSecondary }]}>
              {type === 'personal'
                ? 'Complete a trip with ratings to see them here'
                : 'This area needs more community ratings'}
            </Text>
          </View>
        </View>
      );
    }
    
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

const styles = StyleSheet.create({
  emptyMessageContainer: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  emptyMessage: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    maxWidth: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyMessageText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  emptyMessageSubtext: {
    fontSize: 12,
    textAlign: 'center',
  },
});
