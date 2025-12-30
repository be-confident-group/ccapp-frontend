import React, { useState, useCallback } from 'react';
import {
  Modal,
  StyleSheet,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { Spacing } from '@/constants/theme';
import { useMyClubs } from '@/lib/hooks/useClubs';
import { tripAPI } from '@/lib/api/trips';
import { XMarkIcon, CheckIcon } from 'react-native-heroicons/outline';
import type { Club } from '@/types/feed';

interface ShareTripModalProps {
  visible: boolean;
  tripId: number;
  tripDistance?: number; // km
  onClose: () => void;
  onSuccess?: (postId: number) => void;
}

export function ShareTripModal({
  visible,
  tripId,
  tripDistance,
  onClose,
  onSuccess,
}: ShareTripModalProps) {
  const { t } = useTranslation('groups');
  const { colors } = useTheme();

  const [selectedClubId, setSelectedClubId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [isSharing, setIsSharing] = useState(false);

  const { data: myClubs, isLoading } = useMyClubs();

  const handleShare = useCallback(async () => {
    if (!selectedClubId) {
      alert(t('trips.selectClub', 'Please select a club'));
      return;
    }

    setIsSharing(true);
    try {
      const response = await tripAPI.shareTrip(
        tripId,
        selectedClubId,
        title.trim() || undefined,
        text.trim() || undefined
      );

      // Reset form
      setSelectedClubId(null);
      setTitle('');
      setText('');

      // Call success callback
      onSuccess?.(response.post_id);

      // Close modal
      onClose();
    } catch (error) {
      console.error('Failed to share trip:', error);
      alert(error instanceof Error ? error.message : 'Failed to share trip');
    } finally {
      setIsSharing(false);
    }
  }, [tripId, selectedClubId, title, text, onSuccess, onClose, t]);

  const handleClose = useCallback(() => {
    if (!isSharing) {
      setSelectedClubId(null);
      setTitle('');
      setText('');
      onClose();
    }
  }, [isSharing, onClose]);

  const renderClubItem = useCallback(
    (club: Club) => {
      const isSelected = selectedClubId === club.id;

      return (
        <TouchableOpacity
          key={club.id}
          style={[
            styles.clubItem,
            { backgroundColor: colors.card, borderColor: colors.border },
            isSelected && { borderColor: colors.primary, backgroundColor: colors.primary + '15' },
          ]}
          onPress={() => setSelectedClubId(club.id)}
          activeOpacity={0.7}
          disabled={isSharing}
        >
          <View style={styles.clubInfo}>
            <ThemedText style={styles.clubName}>{club.name}</ThemedText>
            <ThemedText style={[styles.clubMeta, { color: colors.textMuted }]}>
              {club.members_count} {club.members_count === 1 ? 'member' : 'members'}
            </ThemedText>
          </View>
          {isSelected && (
            <View style={[styles.checkmark, { backgroundColor: colors.primary }]}>
              <CheckIcon size={16} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
      );
    },
    [selectedClubId, colors, isSharing]
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <ThemedText style={styles.headerTitle}>
            {t('trips.shareToClub', 'Share to Club')}
          </ThemedText>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            disabled={isSharing}
          >
            <XMarkIcon size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Club Selection */}
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>
              {t('trips.selectClub', 'Select Club')} *
            </ThemedText>
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : myClubs && myClubs.length > 0 ? (
              <View style={styles.clubsList}>
                {myClubs.map(renderClubItem)}
              </View>
            ) : (
              <ThemedText style={[styles.emptyText, { color: colors.textMuted }]}>
                {t('trips.noClubs', 'Join a club first to share your activities')}
              </ThemedText>
            )}
          </View>

          {/* Optional Title */}
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>
              {t('trips.postTitle', 'Post Title')} {t('trips.optional', '(Optional)')}
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.card, color: colors.text, borderColor: colors.border },
              ]}
              placeholder={
                tripDistance
                  ? `New Activity: ${tripDistance.toFixed(1)}km`
                  : t('trips.titlePlaceholder', 'Enter title...')
              }
              placeholderTextColor={colors.textMuted}
              value={title}
              onChangeText={setTitle}
              maxLength={255}
              editable={!isSharing}
            />
          </View>

          {/* Optional Text */}
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>
              {t('trips.postText', 'Post Text')} {t('trips.optional', '(Optional)')}
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                styles.textArea,
                { backgroundColor: colors.card, color: colors.text, borderColor: colors.border },
              ]}
              placeholder={t('trips.textPlaceholder', 'Share your experience...')}
              placeholderTextColor={colors.textMuted}
              value={text}
              onChangeText={setText}
              maxLength={500}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={!isSharing}
            />
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[
              styles.shareButton,
              { backgroundColor: colors.primary },
              (!selectedClubId || isSharing) && styles.shareButtonDisabled,
            ]}
            onPress={handleShare}
            disabled={!selectedClubId || isSharing}
            activeOpacity={0.8}
          >
            {isSharing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <ThemedText style={[styles.shareButtonText, { color: '#fff' }]}>
                {t('trips.share', 'Share')}
              </ThemedText>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: Spacing.sm,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.xl,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  clubsList: {
    gap: Spacing.sm,
  },
  clubItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: 8,
    borderWidth: 2,
  },
  clubInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  clubName: {
    fontSize: 16,
    fontWeight: '600',
  },
  clubMeta: {
    fontSize: 12,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  input: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
    paddingTop: Spacing.md,
  },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
  },
  shareButton: {
    paddingVertical: Spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  shareButtonDisabled: {
    opacity: 0.5,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
