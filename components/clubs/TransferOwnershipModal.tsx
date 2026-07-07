import React from 'react';
import { Modal, View, FlatList, TouchableOpacity, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedText } from '@/components/themed-text';
import { UserAvatar } from '@/components/feed/UserAvatar';
import { XMarkIcon } from 'react-native-heroicons/outline';
import { useTransferOwnership } from '@/lib/hooks/useClubs';
import { showErrorAlert } from '@/lib/utils/alert';
import { Spacing, BorderRadius } from '@/constants/theme';
import type { Club, SimpleProfile } from '@/types/feed';
import i18n from '@/lib/i18n';

interface TransferOwnershipModalProps {
  visible: boolean;
  club: Club;
  onClose: () => void;
  onTransferred?: () => void;
}

export function TransferOwnershipModal({ visible, club, onClose, onTransferred }: TransferOwnershipModalProps) {
  const { t } = useTranslation('groups');
  const { colors } = useTheme();
  const transferOwnershipMutation = useTransferOwnership(club.id);

  const eligibleMembers = club.members.filter((m) => m.id !== club.owner.id);

  const handleSelect = (member: SimpleProfile) => {
    const memberName = `${member.name} ${member.last_name}`.trim();
    Alert.alert(
      t('clubs.confirmTransferTitle', 'Transfer Ownership'),
      i18n.t('groups:clubs.confirmTransferMessage', {
        defaultValue: 'Transfer ownership of "{{clubName}}" to {{memberName}}? You will become a regular member.',
        clubName: club.name,
        memberName,
      }),
      [
        { text: t('common:buttons.cancel'), style: 'cancel' },
        {
          text: t('clubs.transfer', 'Transfer'),
          onPress: async () => {
            try {
              await transferOwnershipMutation.mutateAsync(member.id);
              onClose();
              onTransferred?.();
            } catch {
              showErrorAlert('generic');
            }
          },
        },
      ]
    );
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={styles.header}>
            <ThemedText style={styles.title}>
              {t('clubs.selectNewOwner', 'Select New Owner')}
            </ThemedText>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <XMarkIcon size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
            {t('clubs.selectNewOwnerDesc', 'Choose a member to become the new owner of this group.')}
          </ThemedText>

          {eligibleMembers.length === 0 ? (
            <View style={styles.emptyState}>
              <ThemedText style={{ color: colors.textSecondary }}>
                {t('clubs.noOtherMembers', 'You need at least one other member to transfer ownership.')}
              </ThemedText>
            </View>
          ) : (
            <FlatList
              data={eligibleMembers}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.memberRow, { borderColor: colors.border }]}
                  onPress={() => handleSelect(item)}
                  disabled={transferOwnershipMutation.isPending}
                  activeOpacity={0.7}
                >
                  <UserAvatar imageUri={item.profile_picture ?? undefined} name={`${item.name} ${item.last_name}`} size={40} />
                  <ThemedText style={styles.memberName}>
                    {item.name} {item.last_name}
                  </ThemedText>
                  {transferOwnershipMutation.isPending && (
                    <ActivityIndicator size="small" color={colors.textSecondary} />
                  )}
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
    marginBottom: Spacing.md,
  },
  emptyState: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  listContent: {
    gap: 8,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
});
