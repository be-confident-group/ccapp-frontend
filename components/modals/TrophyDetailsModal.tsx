import { ThemedText } from '@/components/themed-text';
import { Spacing, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import type { Trophy } from '@/lib/api/trophies';
import { GlassSheet } from '@/components/ui/GlassSheet';
import { useTranslation } from 'react-i18next';
import React from 'react';
import { StyleSheet, View, Image } from 'react-native';

interface TrophyDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  trophy: Trophy | null;
}

export function TrophyDetailsModal({ visible, onClose, trophy }: TrophyDetailsModalProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  if (!trophy) return null;


  return (
    <GlassSheet visible={visible} onClose={onClose}>
        {/* Trophy Icon */}
        <View style={styles.iconContainer}>
          <Image
            source={require('@/assets/images/page-icons/trophy.png')}
            style={[
              styles.trophyImage,
              { opacity: trophy.is_earned ? 1 : 0.4 }
            ]}
          />
        </View>

        {/* Trophy Name */}
        <ThemedText style={styles.trophyName}>{trophy.name}</ThemedText>

        {/* Status Badge */}
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: trophy.is_earned
                ? colors.primary + '20'
                : colors.border,
            },
          ]}
        >
          <ThemedText
            style={[
              styles.statusText,
              {
                color: trophy.is_earned ? colors.primary : colors.textSecondary,
              },
            ]}
          >
            {trophy.is_earned ? t('common:trophyDetails.earned', 'Earned') : t('common:trophyDetails.notEarned', 'Not Earned')}
          </ThemedText>
        </View>

        {/* Description */}
        <ThemedText style={[styles.description, { color: colors.textSecondary }]}>
          {trophy.description}
        </ThemedText>

        {/* Progress Bar */}
        {!trophy.is_earned && (
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <ThemedText style={styles.progressLabel}>{t('common:trophyDetails.progress', 'Progress')}</ThemedText>
              <ThemedText style={[styles.progressPercentage, { color: colors.primary }]}>
                {Math.round(trophy.progress)}%
              </ThemedText>
            </View>
            <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    backgroundColor: colors.primary,
                    width: `${trophy.progress}%`,
                  },
                ]}
              />
            </View>
          </View>
        )}
    </GlassSheet>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  trophyImage: {
    width: 100,
    height: 100,
    resizeMode: 'contain',
  },
  trophyName: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  statusBadge: {
    alignSelf: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  progressSection: {
    marginBottom: Spacing.lg,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: '700',
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
});
