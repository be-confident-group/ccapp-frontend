/**
 * FeedbackDetailSheet Component
 * Modal for displaying feedback details when a marker is tapped
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { GlassSheet } from '@/components/ui/GlassSheet';
import type { MapFeedback } from '@/lib/api/mapFeedback';
import type { GlobalFeedback } from '@/lib/api/globalFeedback';
import { getCategoryIcon } from '@/lib/utils/feedbackHelpers';
import { useTranslation } from 'react-i18next';

interface FeedbackDetailSheetProps {
  feedback: MapFeedback | GlobalFeedback | null;
  visible: boolean;
  onClose: () => void;
}

export function FeedbackDetailSheet({ feedback, visible, onClose }: FeedbackDetailSheetProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  if (!feedback) return null;

  const isPersonal = 'title' in feedback;
  const categoryIcon = getCategoryIcon(feedback.category);

  // Format category for display
  const categoryText = t(`maps:feedback.categories.${feedback.category}`, feedback.category);

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return t('maps:feedback.just_now', 'Just now');
    if (hours < 24) return t('maps:feedback.hours_ago', { count: hours, defaultValue: `${hours}h ago` });
    if (days < 7) return t('maps:feedback.days_ago', { count: days, defaultValue: `${days}d ago` });

    return date.toLocaleDateString();
  };

  // Confidence stars
  const getConfidenceStars = (level: 'low' | 'medium' | 'high') => {
    const stars = { low: '⭐', medium: '⭐⭐', high: '⭐⭐⭐' };
    return stars[level];
  };

  return (
    <GlassSheet visible={visible} onClose={onClose}>
    {/* Header with icon and category */}
    <View style={styles.header}>
      <Text style={styles.icon}>{categoryIcon}</Text>
      <Text style={[styles.category, { color: colors.text }]}>
        {categoryText}
      </Text>
    </View>

    {/* Personal feedback details */}
    {isPersonal && (
      <>
        <Text style={[styles.title, { color: colors.text }]}>
          {feedback.title}
        </Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          {feedback.description}
        </Text>
        <Text style={[styles.timestamp, { color: colors.textTertiary }]}>
          {formatDate(feedback.created_at)}
        </Text>
      </>
    )}

    {/* Global feedback details */}
    {!isPersonal && (
      <>
        <View style={styles.infoRow}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {t('maps:feedback.confidence.label', 'Confidence')}:
          </Text>
          <Text style={[styles.value, { color: colors.text }]}>
            {t(`maps:feedback.confidence.${feedback.confidence_level}`, feedback.confidence_level)}{' '}
            {getConfidenceStars(feedback.confidence_level)}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {t('maps:feedback.signal_strength', 'Signal Strength')}:
          </Text>
          <Text style={[styles.value, { color: colors.text }]}>
            {Math.round(feedback.signal_strength * 100)}%
          </Text>
        </View>

        <Text style={[styles.timestamp, { color: colors.textTertiary }]}>
          {t('maps:feedback.last_updated', 'Last updated')}: {formatDate(feedback.last_processed_at)}
        </Text>
      </>
    )}
    </GlassSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  icon: {
    fontSize: 32,
    marginRight: 12,
  },
  category: {
    fontSize: 18,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 15,
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 13,
    marginTop: 8,
  },
});
