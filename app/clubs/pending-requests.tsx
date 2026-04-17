import React, { useCallback } from 'react';
import {
  StyleSheet,
  View,
  Image,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import Header from '@/components/layout/Header';
import { useTheme } from '@/contexts/ThemeContext';
import { Spacing } from '@/constants/theme';
import {
  useJoinRequests,
  useAcceptJoinRequest,
  useRejectJoinRequest,
} from '@/lib/hooks/useClubs';
import { CheckIcon, XMarkIcon } from 'react-native-heroicons/outline';
import type { JoinRequest } from '@/types/feed';

export default function PendingRequestsScreen() {
  const { t } = useTranslation('groups');
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ id: string }>();
  const clubId = params.id ? parseInt(params.id, 10) : 0;

  const { data: requests, isLoading, refetch } = useJoinRequests(clubId, !!clubId);
  const acceptMutation = useAcceptJoinRequest(clubId);
  const rejectMutation = useRejectJoinRequest(clubId);

  const handleAccept = useCallback(
    (request: JoinRequest) => {
      Alert.alert(
        t('clubs.acceptRequest', 'Accept Request'),
        t('clubs.acceptRequestConfirm', `Accept ${request.user.name}'s request to join?`),
        [
          { text: t('common:buttons.cancel', 'Cancel'), style: 'cancel' },
          {
            text: t('clubs.accept', 'Accept'),
            onPress: async () => {
              try {
                await acceptMutation.mutateAsync(request.id);
              } catch {
                Alert.alert(t('common:error', 'Error'), t('clubs.acceptFailed', 'Failed to accept request'));
              }
            },
          },
        ]
      );
    },
    [acceptMutation, t]
  );

  const handleReject = useCallback(
    (request: JoinRequest) => {
      Alert.alert(
        t('clubs.rejectRequest', 'Decline Request'),
        t('clubs.rejectRequestConfirm', `Decline ${request.user.name}'s request?`),
        [
          { text: t('common:buttons.cancel', 'Cancel'), style: 'cancel' },
          {
            text: t('clubs.decline', 'Decline'),
            style: 'destructive',
            onPress: async () => {
              try {
                await rejectMutation.mutateAsync(request.id);
              } catch {
                Alert.alert(t('common:error', 'Error'), t('clubs.rejectFailed', 'Failed to decline request'));
              }
            },
          },
        ]
      );
    },
    [rejectMutation, t]
  );

  const renderItem = useCallback(
    ({ item }: { item: JoinRequest }) => (
      <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {item.user.profile_picture ? (
          <Image source={{ uri: item.user.profile_picture }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: colors.border }]}>
            <ThemedText style={styles.avatarInitial}>
              {item.user.name.charAt(0).toUpperCase()}
            </ThemedText>
          </View>
        )}
        <View style={styles.rowInfo}>
          <ThemedText style={styles.memberName}>
            {item.user.name} {item.user.last_name}
          </ThemedText>
          <ThemedText style={[styles.requestedAt, { color: colors.textMuted }]}>
            {new Date(item.created_at).toLocaleDateString()}
          </ThemedText>
        </View>
        <View style={styles.rowActions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={() => handleAccept(item)}
            disabled={acceptMutation.isPending || rejectMutation.isPending}
          >
            <CheckIcon size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.error }]}
            onPress={() => handleReject(item)}
            disabled={acceptMutation.isPending || rejectMutation.isPending}
          >
            <XMarkIcon size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    ),
    [colors, acceptMutation.isPending, rejectMutation.isPending, handleAccept, handleReject]
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <Header title={t('clubs.pendingRequests', 'Pending Requests')} showBack />
      <ThemedView style={styles.container}>
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={requests ?? []}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            onRefresh={refetch}
            refreshing={false}
            ListEmptyComponent={
              <View style={styles.center}>
                <ThemedText style={[styles.emptyText, { color: colors.textMuted }]}>
                  {t('clubs.noRequests', 'No pending requests')}
                </ThemedText>
              </View>
            }
          />
        )}
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  list: { padding: Spacing.lg, gap: Spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    gap: Spacing.md,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: 18, fontWeight: '600' },
  rowInfo: { flex: 1, gap: 2 },
  memberName: { fontSize: 15, fontWeight: '600' },
  requestedAt: { fontSize: 12 },
  rowActions: { flexDirection: 'row', gap: Spacing.sm },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { fontSize: 14, textAlign: 'center' },
});
