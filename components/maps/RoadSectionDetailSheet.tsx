/**
 * RoadSectionDetailSheet Component
 * Modal for displaying road section details when a segment is tapped
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { MaterialIcons } from '@expo/vector-icons';
import type { RoadSectionPersonal, RoadSectionCommunity } from '@/lib/api/roadSections';
import { RATING_LABELS, RATING_COLORS, getRatingColor } from '@/lib/api/roadSections';
import { useTranslation } from 'react-i18next';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface RoadSectionDetailSheetProps {
  section: RoadSectionPersonal | RoadSectionCommunity | null;
  visible: boolean;
  onClose: () => void;
}

export function RoadSectionDetailSheet({ section, visible, onClose }: RoadSectionDetailSheetProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  if (!section) return null;

  const isPersonal = !('community_score' in section);
  const score = isPersonal ? section.rating : section.community_score;
  const ratingColor = getRatingColor(score);

  // Get rating label
  const getRatingLabel = (rating: number): string => {
    const roundedRating = Math.round(rating);
    const key = `maps:road_sections.ratings.${RATING_LABELS[roundedRating]?.toLowerCase() || 'comfortable'}`;
    return t(key, RATING_LABELS[roundedRating] || 'Unknown');
  };

  // Rating bar component
  const RatingBar = ({ value, maxValue = 4 }: { value: number; maxValue?: number }) => {
    const percentage = (value / maxValue) * 100;
    return (
      <View style={[styles.ratingBarContainer, { backgroundColor: colors.border }]}>
        <View
          style={[
            styles.ratingBarFill,
            { width: `${percentage}%`, backgroundColor: ratingColor },
          ]}
        />
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
      >
        <View
          style={[
            styles.container,
            { backgroundColor: colors.card },
          ]}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.content}>
            {/* Rating indicator */}
            <View style={styles.ratingHeader}>
              <View style={[styles.ratingCircle, { backgroundColor: ratingColor }]}>
                <Text style={styles.ratingNumber}>
                  {score.toFixed(1)}
                </Text>
              </View>
              <View style={styles.ratingInfo}>
                <Text style={[styles.ratingLabel, { color: colors.text }]}>
                  {getRatingLabel(score)}
                </Text>
                <RatingBar value={score} />
              </View>
            </View>

            {/* Details */}
            {isPersonal ? (
              // Personal section details
              <View style={styles.detailsContainer}>
                <View style={styles.detailRow}>
                  <MaterialIcons name="person" size={20} color={colors.textSecondary} />
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                    {t('maps:road_sections.your_rating', 'Your Rating')}
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {getRatingLabel(section.rating)}
                  </Text>
                </View>
              </View>
            ) : (
              // Community section details
              <View style={styles.detailsContainer}>
                <View style={styles.detailRow}>
                  <MaterialIcons name="people" size={20} color={colors.textSecondary} />
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                    {t('maps:road_sections.community_score', 'Community Score')}
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {section.community_score.toFixed(2)}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <MaterialIcons name="how-to-vote" size={20} color={colors.textSecondary} />
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                    {t('maps:road_sections.rating_count', 'Ratings')}
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {section.rating_count}
                  </Text>
                </View>
              </View>
            )}

            {/* Legend */}
            <View style={styles.legend}>
              <Text style={[styles.legendTitle, { color: colors.textSecondary }]}>
                {t('maps:road_sections.legend', 'Rating Scale')}
              </Text>
              <View style={styles.legendRow}>
                {[1, 2, 3, 4].map((rating) => (
                  <View key={rating} style={styles.legendItem}>
                    <View
                      style={[styles.legendDot, { backgroundColor: RATING_COLORS[rating] }]}
                    />
                    <Text style={[styles.legendText, { color: colors.textSecondary }]}>
                      {rating}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* Close button */}
          <Pressable
            style={[styles.closeButton, { backgroundColor: colors.primary }]}
            onPress={onClose}
          >
            <MaterialIcons name="close" size={24} color="#FFFFFF" />
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: SCREEN_HEIGHT * 0.45,
    maxWidth: 400,
    borderRadius: 20,
    paddingVertical: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 16,
  },
  content: {
    paddingHorizontal: 20,
  },
  ratingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  ratingCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  ratingNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  ratingInfo: {
    flex: 1,
  },
  ratingLabel: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  ratingBarContainer: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  ratingBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  detailsContainer: {
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  detailLabel: {
    flex: 1,
    fontSize: 15,
    marginLeft: 12,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  legend: {
    marginTop: 8,
  },
  legendTitle: {
    fontSize: 13,
    marginBottom: 8,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
