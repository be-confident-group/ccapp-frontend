/**
 * FeedbackDetailSheet Component
 * Modal for displaying feedback details when a marker is tapped
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { MaterialIcons } from '@expo/vector-icons';
import type { MapFeedback } from '@/lib/api/mapFeedback';
import type { GlobalFeedback } from '@/lib/api/globalFeedback';
import { getCategoryIcon } from '@/lib/utils/feedbackHelpers';
import { useTranslation } from 'react-i18next';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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
    if (hours < 24) return t('maps:feedback.hours_ago', { count: hours }, `${hours}h ago`);
    if (days < 7) return t('maps:feedback.days_ago', { count: days }, `${days}d ago`);

    return date.toLocaleDateString();
  };

  // Confidence stars
  const getConfidenceStars = (level: 'low' | 'medium' | 'high') => {
    const stars = { low: '⭐', medium: '⭐⭐', high: '⭐⭐⭐' };
    return stars[level];
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
      >
        <View
          style={[
            styles.container,
            { backgroundColor: colors.card, borderTopColor: colors.border },
          ]}
          onStartShouldSetResponder={() => true}
        >
          {/* Handle bar */}
          <View style={styles.handleContainer}>
            <View style={[styles.handle, { backgroundColor: colors.textSecondary }]} />
          </View>

          <ScrollView style={styles.content}>
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
          </ScrollView>

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
    justifyContent: 'flex-end',
  },
  container: {
    maxHeight: SCREEN_HEIGHT * 0.6,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    paddingBottom: 20,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    opacity: 0.3,
  },
  content: {
    paddingHorizontal: 20,
  },
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
