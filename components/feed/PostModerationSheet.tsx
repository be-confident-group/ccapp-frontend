import React, { useState } from 'react';
import { View, Modal, TouchableOpacity, ScrollView, Linking, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  FlagIcon,
  NoSymbolIcon,
  XMarkIcon,
} from 'react-native-heroicons/outline';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedText } from '@/components/themed-text';
import { TextInput, Button } from '@/components/ui';
import { Spacing, BorderRadius, FontSizes } from '@/constants/theme';
import { showConfirmAlert, showAlert } from '@/lib/utils/alert';
import { useBlockUser } from '@/lib/hooks/useBlockedUsers';
import { SUPPORT_EMAIL } from '@/config/env';

const REPORT_REASONS = ['spam', 'harassment', 'inappropriate', 'misinformation', 'other'] as const;
type ReportReason = (typeof REPORT_REASONS)[number];

export interface ModerationTarget {
  postId: number;
  authorId: number;
  authorName: string;
  clubName?: string;
}

interface PostModerationSheetProps {
  visible: boolean;
  target: ModerationTarget | null;
  onClose: () => void;
}

/**
 * Report + block entry point for a single post, opened from the feed,
 * a club's post list, or the post-detail screen (App Store Guideline 1.2).
 *
 * Report is handled via a pre-filled email to SUPPORT_EMAIL rather than a
 * backend endpoint, since there's no moderation-queue API yet.
 * TODO(backend): replace with a real reports endpoint once one exists, so
 * reports are tracked and can be answered within 24 hours as the guideline
 * requires.
 */
export function PostModerationSheet({ visible, target, onClose }: PostModerationSheetProps) {
  const { t } = useTranslation('groups');
  const { colors } = useTheme();
  const [mode, setMode] = useState<'menu' | 'report'>('menu');
  const [reason, setReason] = useState<ReportReason>('spam');
  const [details, setDetails] = useState('');
  const blockUser = useBlockUser();

  const reset = () => {
    setMode('menu');
    setReason('spam');
    setDetails('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleBlock = () => {
    if (!target) return;
    showConfirmAlert(
      'groups:moderation.blockConfirmTitle',
      'groups:moderation.blockConfirmMessage',
      () => {
        blockUser.mutate(target.authorId, {
          onSuccess: () => {
            showAlert('alerts:moderation.blockedTitle', 'alerts:moderation.blockedMessage');
          },
        });
        handleClose();
      },
      'groups:moderation.blockConfirmButton',
      'common:buttons.cancel',
      'destructive'
    );
  };

  const handleSendReport = async () => {
    if (!target) return;

    const reasonLabel = t(`groups:moderation.reasons.${reason}`);
    const subject = `Reported post #${target.postId}`;
    const bodyLines = [
      `Reason: ${reasonLabel}`,
      `Post ID: ${target.postId}`,
      `Author: ${target.authorName}`,
      target.clubName ? `Group: ${target.clubName}` : null,
      '',
      'Additional details:',
      details.trim() || '(none)',
    ].filter((line): line is string => line !== null);

    const mailUrl = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
      bodyLines.join('\n')
    )}`;

    try {
      const canOpen = await Linking.canOpenURL(mailUrl);
      if (!canOpen) throw new Error('No mail client available');
      await Linking.openURL(mailUrl);
      showAlert('alerts:moderation.reportOpenedTitle', 'alerts:moderation.reportOpenedMessage');
    } catch {
      showAlert(
        'alerts:moderation.reportFailedTitle',
        'alerts:moderation.reportFailedMessage',
        undefined,
        { cancelable: true }
      );
    }

    handleClose();
  };

  if (!target) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <ThemedText style={styles.headerTitle}>
              {mode === 'menu' ? t('groups:moderation.report') : t('groups:moderation.reportTitle')}
            </ThemedText>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <XMarkIcon size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          {mode === 'menu' ? (
            <View style={styles.menu}>
              <TouchableOpacity
                style={[styles.menuRow, { borderBottomColor: colors.border }]}
                onPress={() => setMode('report')}
                activeOpacity={0.7}
              >
                <FlagIcon size={20} color={colors.text} />
                <ThemedText style={styles.menuLabel}>{t('groups:moderation.report')}</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuRow}
                onPress={handleBlock}
                activeOpacity={0.7}
              >
                <NoSymbolIcon size={20} color={colors.error} />
                <ThemedText style={[styles.menuLabel, { color: colors.error }]}>
                  {t('groups:moderation.block', { name: target.authorName })}
                </ThemedText>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
              <ThemedText style={styles.label}>{t('groups:moderation.reportReasonLabel')}</ThemedText>
              <View style={styles.reasonList}>
                {REPORT_REASONS.map((r) => (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setReason(r)}
                    style={[
                      styles.reasonChip,
                      { borderColor: colors.border, backgroundColor: colors.card },
                      reason === r && { borderColor: colors.primary, backgroundColor: colors.primary + '20' },
                    ]}
                    activeOpacity={0.7}
                  >
                    <ThemedText style={reason === r ? { color: colors.primary, fontWeight: '600' } : undefined}>
                      {t(`groups:moderation.reasons.${r}`)}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>

              <ThemedText style={[styles.label, styles.detailsLabel]}>
                {t('groups:moderation.detailsLabel')}
              </ThemedText>
              <TextInput
                value={details}
                onChangeText={setDetails}
                placeholder={t('groups:moderation.detailsPlaceholder')}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                style={styles.detailsInput}
                maxLength={500}
              />

              <Button
                title={t('groups:moderation.sendReport')}
                onPress={handleSendReport}
                variant="primary"
                size="large"
                fullWidth
              />
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '75%',
    paddingBottom: Spacing.xl,
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
    fontSize: FontSizes.lg,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  menu: {
    paddingTop: Spacing.sm,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md + 2,
    borderBottomWidth: 1,
  },
  menuLabel: {
    fontSize: FontSizes.md,
    fontWeight: '500',
  },
  scrollView: {
    paddingHorizontal: Spacing.lg,
  },
  scrollContent: {
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  label: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  detailsLabel: {
    marginTop: Spacing.md,
  },
  reasonList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  reasonChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  detailsInput: {
    minHeight: 90,
    marginBottom: Spacing.lg,
  },
});
