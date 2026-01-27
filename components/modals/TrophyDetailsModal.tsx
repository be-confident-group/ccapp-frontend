import { ThemedText } from '@/components/themed-text';
import { Spacing, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import type { Trophy } from '@/lib/api/trophies';
import { XMarkIcon } from 'react-native-heroicons/outline';
import React from 'react';
import {
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
  Image,
  ScrollView,
  Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');
const MODAL_WIDTH = Math.min(width - 48, 400);

interface TrophyDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  trophy: Trophy | null;
}

export function TrophyDetailsModal({ visible, onClose, trophy }: TrophyDetailsModalProps) {
  const { colors } = useTheme();

  if (!trophy) return null;


  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <TouchableOpacity
          style={styles.backdropTouchable}
          activeOpacity={1}
          onPress={onClose}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.modalContainer, { backgroundColor: colors.card }]}>
              {/* Close Button */}
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
              >
                <XMarkIcon size={24} color={colors.icon} />
              </TouchableOpacity>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
              >
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
                    {trophy.is_earned ? 'Earned' : 'Not Earned'}
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
                      <ThemedText style={styles.progressLabel}>Progress</ThemedText>
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

              </ScrollView>
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
    maxHeight: '80%',
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
  scrollContent: {
    paddingTop: Spacing.md,
  },
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
