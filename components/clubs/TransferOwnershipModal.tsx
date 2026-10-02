import React from 'react';
import { View, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedText } from '@/components/themed-text';
import { UserAvatar } from '@/components/feed/UserAvatar';
import { ChevronRightIcon } from 'react-native-heroicons/mini';
import { GlassSheet } from '@/components/ui/GlassSheet';
import { useTransferOwnership } from '@/lib/hooks/useClubs';
import { showErrorAlert } from '@/lib/utils/alert';
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
    <GlassSheet visible={visible} onClose={onClose} title={t('clubs.selectNewOwner', 'Select New Owner')}>
      <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
        {t('clubs.selectNewOwnerDesc', 'Choose a member to become the new owner of this group.')}
      </ThemedText>

      {eligibleMembers.length === 0 ? (
        <View style={styles.emptyState}>
          <ThemedText style={{ color: colors.textSecondary, textAlign: 'center' }}>
            {t('clubs.noOtherMembers', 'You need at least one other member to transfer ownership.')}
          </ThemedText>
        </View>
      ) : (
        <View style={styles.list}>
          {eligibleMembers.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.memberRow,
                { backgroundColor: pressed ? colors.glassHighlight : 'transparent' },
              ]}
              onPress={() => handleSelect(item)}
              disabled={transferOwnershipMutation.isPending}
            >
              <UserAvatar imageUri={item.profile_picture ?? undefined} name={`${item.name} ${item.last_name}`} size={40} />
              <ThemedText style={styles.memberName} numberOfLines={1}>
                {item.name} {item.last_name}
              </ThemedText>
              {transferOwnershipMutation.isPending ? (
                <ActivityIndicator size="small" color={colors.textSecondary} />
              ) : (
                <ChevronRightIcon size={20} color={colors.textSecondary} />
              )}
            </Pressable>
          ))}
        </View>
      )}
    </GlassSheet>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    fontSize: 14,
    marginBottom: 12,
  },
  emptyState: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  list: {
    gap: 4,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 16,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
});
