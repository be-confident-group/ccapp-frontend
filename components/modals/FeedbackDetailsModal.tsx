import React from 'react';
import { Modal, StyleSheet, TouchableOpacity, View, Dimensions, Text } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { XMarkIcon } from 'react-native-heroicons/outline';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { MapFeedback } from '@/lib/api/mapFeedback';
import type { GlobalFeedback } from '@/lib/api/globalFeedback';
import { getCategoryIcon, getCategoryColor } from '@/lib/utils/feedbackHelpers';
import { useTranslation } from 'react-i18next';
import { Spacing } from '@/constants/theme';

interface FeedbackDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  feedback: MapFeedback | GlobalFeedback | null;
}

const { width } = Dimensions.get('window');
const MODAL_WIDTH = Math.min(width - 48, 400);

export function FeedbackDetailsModal({ visible, onClose, feedback }: FeedbackDetailsModalProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  if (!feedback) return null;

  const isPersonal = 'title' in feedback;
  const categoryIcon = getCategoryIcon(feedback.category);
  const categoryColor = getCategoryColor(feedback.category);

  // Category display name
  const categoryText = t(`maps:feedback.categories.${feedback.category}`, feedback.category);

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return t('maps:feedback.just_now', 'Just now');
    if (hours < 24) return t('maps:feedback.hours_ago', { count: hours }, `${hours}h ago`);
    if (days < 7) return t('maps:feedback.days_ago', { count: days }, `${days}d ago`);

    return date.toLocaleDateString();
  };

  // Get confidence stars
  const getConfidenceStars = (level: 'low' | 'medium' | 'high') => {
    const stars = { low: 1, medium: 2, high: 3 };
    return stars[level];
  };

  // Background color with opacity for icon container
  const getIconBackgroundColor = (color: string, opacity: number = 0.15) => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTouchable} activeOpacity={1} onPress={onClose}>
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.modalContainer, { backgroundColor: colors.card }]}>
              {/* Close Button */}
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <XMarkIcon size={24} color={colors.icon} />
              </TouchableOpacity>

              {/* Header */}
              <View style={styles.header}>
                <View style={[styles.iconContainer, { backgroundColor: getIconBackgroundColor(categoryColor) }]}>
                  <Text style={styles.iconEmoji}>{categoryIcon}</Text>
                </View>
                <Text style={[styles.category, { color: colors.text }]}>
                  {categoryText}
                </Text>
                {isPersonal && (
                  <>
                    <ThemedText style={styles.title}>{feedback.title}</ThemedText>
                    <ThemedText style={[styles.description, { color: colors.textSecondary }]}>
                      {feedback.description}
                    </ThemedText>
                  </>
                )}
              </View>

              {/* Divider */}
              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              {/* Details Grid */}
              <View style={styles.detailsGrid}>
                {isPersonal ? (
                  // Personal feedback details
                  <>
                    <View style={styles.detailItem}>
                      <View style={[styles.detailIconContainer, { backgroundColor: '#DBEAFE' }]}>
                        <MaterialCommunityIcons name="account" size={24} color="#3B82F6" />
                      </View>
                      <ThemedText style={[styles.detailLabel, { color: colors.textSecondary }]}>
                        {t('maps:feedback.type', 'Type')}
                      </ThemedText>
                      <ThemedText style={styles.detailValue}>
                        {t('maps:feedback.personal', 'Personal')}
                      </ThemedText>
                    </View>

                    <View style={styles.detailItem}>
                      <View style={[styles.detailIconContainer, { backgroundColor: '#FEF3C7' }]}>
                        <MaterialCommunityIcons name="clock-outline" size={24} color="#F59E0B" />
                      </View>
                      <ThemedText style={[styles.detailLabel, { color: colors.textSecondary }]}>
                        {t('maps:feedback.reported', 'Reported')}
                      </ThemedText>
                      <ThemedText style={styles.detailValue}>
                        {formatDate(feedback.created_at)}
                      </ThemedText>
                    </View>

                    <View style={styles.detailItem}>
                      <View style={[styles.detailIconContainer, { backgroundColor: getIconBackgroundColor(categoryColor) }]}>
                        <MaterialCommunityIcons name="map-marker" size={24} color={categoryColor} />
                      </View>
                      <ThemedText style={[styles.detailLabel, { color: colors.textSecondary }]}>
                        {t('maps:feedback.status', 'Status')}
                      </ThemedText>
                      <ThemedText style={styles.detailValue}>
                        {t('maps:feedback.active', 'Active')}
                      </ThemedText>
                    </View>
                  </>
                ) : (
                  // Community feedback details
                  <>
                    <View style={styles.detailItem}>
                      <View style={[styles.detailIconContainer, { backgroundColor: '#FEF3C7' }]}>
                        <MaterialCommunityIcons name="star" size={24} color="#F59E0B" />
                      </View>
                      <ThemedText style={[styles.detailLabel, { color: colors.textSecondary }]}>
                        {t('maps:feedback.confidence.label', 'Confidence')}
                      </ThemedText>
                      <View style={styles.starsContainer}>
                        {Array.from({ length: 3 }).map((_, i) => (
                          <Text
                            key={i}
                            style={[
                              styles.star,
                              { opacity: i < getConfidenceStars(feedback.confidence_level) ? 1 : 0.3 }
                            ]}
                          >
                            ⭐
                          </Text>
                        ))}
                      </View>
                      <ThemedText style={[styles.detailSmallValue, { color: colors.textSecondary }]}>
                        {t(`maps:feedback.confidence.${feedback.confidence_level}`, feedback.confidence_level)}
                      </ThemedText>
                    </View>

                    <View style={styles.detailItem}>
                      <View style={[styles.detailIconContainer, { backgroundColor: '#DCFCE7' }]}>
                        <MaterialCommunityIcons name="signal" size={24} color="#10B981" />
                      </View>
                      <ThemedText style={[styles.detailLabel, { color: colors.textSecondary }]}>
                        {t('maps:feedback.signal_strength', 'Signal Strength')}
                      </ThemedText>
                      <Text style={[styles.detailValue, { color: colors.text }]}>
                        {Math.round(feedback.signal_strength * 100)}%
                      </Text>
                    </View>

                    <View style={styles.detailItem}>
                      <View style={[styles.detailIconContainer, { backgroundColor: '#E0E7FF' }]}>
                        <MaterialCommunityIcons name="account-group" size={24} color="#6366F1" />
                      </View>
                      <ThemedText style={[styles.detailLabel, { color: colors.textSecondary }]}>
                        {t('maps:feedback.source', 'Source')}
                      </ThemedText>
                      <ThemedText style={styles.detailValue}>
                        {t('maps:feedback.community', 'Community')}
                      </ThemedText>
                    </View>
                  </>
                )}
              </View>

              {/* Footer */}
              <View style={styles.footer}>
                <ThemedText style={[styles.lastUpdated, { color: colors.textSecondary }]}>
                  {t('maps:feedback.last_updated', 'Last updated')}:{' '}
                  {formatDate(isPersonal ? feedback.created_at : feedback.last_processed_at)}
                </ThemedText>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backdropTouchable: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  modalContainer: {
    width: MODAL_WIDTH,
    borderRadius: 24,
    padding: Spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 16,
  },
  closeButton: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  iconEmoji: {
    fontSize: 48,
  },
  category: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: Spacing.sm,
    textTransform: 'capitalize',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.lg,
  },
  detailsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  detailItem: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  detailIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  detailLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  detailValue: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  detailSmallValue: {
    fontSize: 12,
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  star: {
    fontSize: 16,
  },
  footer: {
    alignItems: 'center',
  },
  lastUpdated: {
    fontSize: 12,
  },
});
