import React, { useCallback } from 'react';
import { StyleSheet, View, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import Animated from 'react-native-reanimated';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserPlusIcon } from 'react-native-heroicons/outline';
import { ThemedText } from '@/components/themed-text';
import Button from '@/components/ui/Button';
import { UserAvatar } from '@/components/feed/UserAvatar';
import { useTheme } from '@/contexts/ThemeContext';
import {
  useJoinRequests,
  useAcceptJoinRequest,
  useRejectJoinRequest,
} from '@/lib/hooks/useClubs';
import { ClubEmptyState, ClubScreenHeader, Entrance, useClubScroll } from '@/components/clubs/clubUi';
import type { JoinRequest } from '@/types/feed';

export default function PendingRequestsScreen() {
  const { t } = useTranslation('groups');
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { scrollY, onScroll, topInset } = useClubScroll();
  const params = useLocalSearchParams<{ id: string }>();
  const clubId = params.id ? parseInt(params.id, 10) : 0;

  const { data: requests, isLoading, refetch } = useJoinRequests(clubId, !!clubId);
  const acceptMutation = useAcceptJoinRequest(clubId);
  const rejectMutation = useRejectJoinRequest(clubId);
  const busy = acceptMutation.isPending || rejectMutation.isPending;

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
    ({ item, index }: { item: JoinRequest; index: number }) => (
      <Entrance index={index}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.userRow}>
            <UserAvatar
              imageUri={item.user.profile_picture ?? undefined}
              name={`${item.user.name} ${item.user.last_name}`.trim()}
              size={44}
            />
            <View style={styles.rowInfo}>
              <ThemedText style={styles.memberName} numberOfLines={1}>
                {item.user.name} {item.user.last_name}
              </ThemedText>
              <ThemedText style={[styles.requestedAt, { color: colors.textMuted }]}>
                {new Date(item.created_at).toLocaleDateString()}
              </ThemedText>
            </View>
          </View>
          <View style={styles.actions}>
            <View style={styles.actionFlex}>
              <Button
                title={t('clubs.decline', 'Decline')}
                variant="outline"
                size="small"
                fullWidth
                disabled={busy}
                onPress={() => handleReject(item)}
              />
            </View>
            <View style={styles.actionFlex}>
              <Button
                title={t('clubs.accept', 'Accept')}
                size="small"
                fullWidth
                disabled={busy}
                onPress={() => handleAccept(item)}
              />
            </View>
          </View>
        </View>
      </Entrance>
    ),
    [colors, busy, handleAccept, handleReject, t]
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.backgroundSecondary }]}>
      {isLoading ? (
        <View style={[styles.center, { paddingTop: topInset }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <Animated.FlatList
          data={requests ?? []}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          ItemSeparatorComponent={Separator}
          contentContainerStyle={[
            styles.list,
            { paddingTop: topInset, paddingBottom: insets.bottom + 32 },
            (requests?.length ?? 0) === 0 && styles.emptyList,
          ]}
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentInsetAdjustmentBehavior="never"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={refetch} tintColor={colors.primary} progressViewOffset={topInset} />
          }
          ListEmptyComponent={
            <ClubEmptyState
              icon={<UserPlusIcon size={30} color={colors.glassTint} />}
              title={t('clubs.noRequests', 'No pending requests')}
            />
          }
        />
      )}
      <ClubScreenHeader title={t('clubs.pendingRequests', 'Pending Requests')} scrollY={scrollY} />
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 16 },
  emptyList: { flexGrow: 1 },
  separator: { height: 12 },
  card: { borderRadius: 20, padding: 16, gap: 12 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowInfo: { flex: 1, gap: 2 },
  memberName: { fontSize: 16, fontWeight: '600' },
  requestedAt: { fontSize: 13 },
  actions: { flexDirection: 'row', gap: 12 },
  actionFlex: { flex: 1 },
});
