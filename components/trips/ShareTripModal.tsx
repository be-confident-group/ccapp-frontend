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
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { Spacing } from '@/constants/theme';
import { useMyClubs } from '@/lib/hooks/useClubs';
import { tripAPI, type TripShareResult } from '@/lib/api/trips';
import { XMarkIcon, CheckIcon } from 'react-native-heroicons/outline';
import type { Club } from '@/types/feed';

interface ShareTripModalProps {
  visible: boolean;
  tripId: number;
  tripDistance?: number; // km
  onClose: () => void;
  onSuccess?: (results: TripShareResult[]) => void;
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

  // Multi-select: a Set of selected club ids
  const [selectedClubIds, setSelectedClubIds] = useState<Set<number>>(new Set());
  const [caption, setCaption] = useState('');
  const [isSharing, setIsSharing] = useState(false);

  const { data: myClubs, isLoading } = useMyClubs();

  const toggleClub = useCallback((clubId: number) => {
    setSelectedClubIds((prev) => {
      const next = new Set(prev);
      if (next.has(clubId)) {
        next.delete(clubId);
      } else {
        next.add(clubId);
      }
      return next;
    });
  }, []);

  const handleShare = useCallback(async () => {
    if (selectedClubIds.size === 0) {
      alert(t('trips.selectClub', 'Please select at least one club'));
      return;
    }

    setIsSharing(true);
    try {
      const { results } = await tripAPI.shareTrip(
        tripId,
        Array.from(selectedClubIds),
        caption.trim() || undefined
      );

      // Summarise results for the user
      const shared = results.filter((r) => r.status === 'shared').length;
      const alreadyShared = results.filter((r) => r.status === 'already_shared').length;
      const errors = results.filter((r) => r.status === 'error').length;

      const parts: string[] = [];
      if (shared > 0) parts.push(`Shared to ${shared} club${shared > 1 ? 's' : ''}`);
      if (alreadyShared > 0) parts.push(`Already shared to ${alreadyShared}`);
      if (errors > 0) parts.push(`Failed for ${errors}`);

      if (parts.length > 0) {
        Alert.alert('Share Result', parts.join(', '));
      }

      setSelectedClubIds(new Set());
      setCaption('');
      onSuccess?.(results);
      onClose();
    } catch (error) {
      console.error('Failed to share trip:', error);
      alert(error instanceof Error ? error.message : 'Failed to share trip');
    } finally {
      setIsSharing(false);
    }
  }, [tripId, selectedClubIds, caption, onSuccess, onClose, t]);

  const handleClose = useCallback(() => {
    if (!isSharing) {
      setSelectedClubIds(new Set());
      setCaption('');
      onClose();
    }
  }, [isSharing, onClose]);

  const renderClubItem = useCallback(
    (club: Club) => {
      const isSelected = selectedClubIds.has(club.id);

      return (
        <TouchableOpacity
          key={club.id}
          style={[
            styles.clubItem,
            { backgroundColor: colors.card, borderColor: colors.border },
            isSelected && { borderColor: colors.primary, backgroundColor: colors.primary + '15' },
          ]}
          onPress={() => toggleClub(club.id)}
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
    [selectedClubIds, colors, isSharing, toggleClub]
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
          {/* Club Selection — multi-select */}
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>
              {t('trips.selectClub', 'Select Clubs')} *
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

          {/* Optional Caption (replaces separate title + text) */}
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>
              {t('trips.caption', 'Caption')} {t('trips.optional', '(Optional)')}
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                styles.textArea,
                { backgroundColor: colors.card, color: colors.text, borderColor: colors.border },
              ]}
              placeholder={
                tripDistance
                  ? `Just rode ${tripDistance.toFixed(1)} km!`
                  : t('trips.captionPlaceholder', 'Share your experience...')
              }
              placeholderTextColor={colors.textMuted}
              value={caption}
              onChangeText={setCaption}
              maxLength={500}
              multiline
              numberOfLines={3}
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
              (selectedClubIds.size === 0 || isSharing) && styles.shareButtonDisabled,
            ]}
            onPress={handleShare}
            disabled={selectedClubIds.size === 0 || isSharing}
            activeOpacity={0.8}
          >
            {isSharing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <ThemedText style={[styles.shareButtonText, { color: '#fff' }]}>
                {selectedClubIds.size > 1
                  ? `${t('trips.share', 'Share')} (${selectedClubIds.size})`
                  : t('trips.share', 'Share')}
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
    minHeight: 80,
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
