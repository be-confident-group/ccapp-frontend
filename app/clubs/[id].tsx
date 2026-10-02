import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  StyleSheet,
  View,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  Share,
  Platform,
  Modal,
  ScrollView,
  Pressable,
  Text,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import Button from '@/components/ui/Button';
import { GlassButton } from '@/components/ui/GlassButton';
import { GlassMenu } from '@/components/ui/GlassMenu';
import type { GlassMenuAnchor } from '@/components/ui/GlassMenu';
import { GlassSurface } from '@/components/ui/GlassSurface';
import { SettingsGroup } from '@/components/profile/SettingsGroup';
import { SettingsItem } from '@/components/profile/SettingsItem';
import { LinearGradient } from 'expo-linear-gradient';
import { ClubEmptyState, ClubScreenHeader } from '@/components/clubs/clubUi';
import { useTheme } from '@/contexts/ThemeContext';
import { showAlert } from '@/lib/utils/alert';
import {
  useClub,
  useJoinClub,
  useLeaveClub,
  useRequestJoinClub,
  useJoinRequests,
  useRemoveMember,
} from '@/lib/hooks/useClubs';
import { useClubPosts, useTogglePostLike } from '@/lib/hooks/usePosts';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { useBlockedUsers } from '@/lib/hooks/useBlockedUsers';
import { FeedPost, PostModerationSheet } from '@/components/feed';
import type { ModerationTarget } from '@/components/feed';
import {
  UsersIcon,
  PlusIcon,
  ArrowLeftStartOnRectangleIcon,
  PencilSquareIcon,
  MapIcon,
  ShareIcon,
  UserPlusIcon,
  LockClosedIcon,
  GlobeAltIcon,
  ClockIcon,
  EllipsisHorizontalIcon,
  ChatBubbleLeftRightIcon,
} from 'react-native-heroicons/outline';
import { ChevronLeftIcon } from 'react-native-heroicons/solid';
import type { Post , ActivityPost } from '@/types/feed';

const BUTTON_SIZE = 40;
const SHEET_OVERLAP = 28;
// Height of the primary pill and the round glass buttons beside it.
const ACTION_SIZE = 52;

type ClubMenuKey = 'edit' | 'requests' | 'none';

// Helper function to transform backend Post to ActivityPost for legacy component
function transformPostToActivityPost(post: Post): ActivityPost {
  return {
    id: post.id.toString(),
    user: {
      id: post.author.name,
      name: `${post.author.name} ${post.author.last_name}`,
      avatarUrl: post.author.profile_picture || undefined,
    },
    location: undefined,
    photos: post.photos.map((p) => p.image || ''),
    title: post.title,
    caption: post.text,
    activityType:
      post.trip?.type === 'cycle' ? 'ride' : ((post.trip?.type || 'walk') as 'walk' | 'ride' | 'run'),
    distance: post.trip?.distance,
    duration: post.trip?.duration,
    likeCount: post.likes_count,
    commentCount: post.comment_count,
    isLiked: post.is_liked,
    createdAt: post.created_at,
    groupId: post.club_id.toString(),
  };
}

export default function ClubDetailScreen() {
  const { t } = useTranslation('groups');
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ id: string }>();
  const clubId = params.id ? parseInt(params.id, 10) : 0;

  // --- Presentation: hero / scroll / menu state ---
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const heroHeight = Math.round(windowHeight * 0.34) + insets.top;
  const pillHideOffset = insets.top + BUTTON_SIZE + 24;
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const moreRef = useRef<View>(null);
  const [menuAnchor, setMenuAnchor] = useState<GlassMenuAnchor | null>(null);

  // Pull-down: stretch from the top edge so the photo always reaches the content.
  // Scroll up: move at half speed (parallax) but never leave the top of the screen.
  const heroAnimatedStyle = useAnimatedStyle(() => {
    const y = scrollY.value;
    if (y < 0) {
      return { transform: [{ translateY: 0 }, { scale: 1 + -y / heroHeight }] };
    }
    return { transform: [{ translateY: -Math.min(y, heroHeight) * 0.5 }, { scale: 1 }] };
  });

  const pillAnimatedStyle = useAnimatedStyle(() => {
    const start = heroHeight - insets.top - 120;
    const p = interpolate(scrollY.value, [start, start + 60], [0, 1], Extrapolation.CLAMP);
    return { transform: [{ translateY: (1 - p) * -pillHideOffset }, { scale: 0.9 + 0.1 * p }] };
  });

  const statusBackdropStyle = useAnimatedStyle(() => {
    const start = heroHeight - insets.top - 100;
    return { opacity: interpolate(scrollY.value, [start, start + 60], [0, 1], Extrapolation.CLAMP) };
  });

  const { data: club, isLoading, refetch, isRefetching } = useClub(clubId);
  const { data: posts, refetch: refetchPosts } = useClubPosts(clubId);
  const { data: currentUser } = useCurrentUser();
  const joinClubMutation = useJoinClub();
  const leaveClubMutation = useLeaveClub();
  const requestJoinMutation = useRequestJoinClub();
  const removeMemberMutation = useRemoveMember(clubId);
  const { mutate: toggleLike } = useTogglePostLike();

  // Track whether the current user has a pending join request for this private club
  const [joinRequestPending, setJoinRequestPending] = useState(false);

  // Fetch pending join-requests only when the user is the owner
  const isOwnerResolved = useMemo(() => {
    if (!club || !currentUser || !club.owner) return false;
    if (currentUser.id !== undefined) {
      return Number(club.owner.id) === Number(currentUser.id);
    }
    // Fallback when profile API doesn't expose id
    return club.owner.name === currentUser.name && club.owner.last_name === currentUser.last_name;
  }, [club, currentUser]);

  const { data: joinRequests } = useJoinRequests(clubId, isOwnerResolved);
  const { data: blockedUserIds = [] } = useBlockedUsers();

  // Store sorted backend posts for like handler — blocked authors are
  // filtered out here so their posts disappear from this club on this device.
  const sortedPosts = useMemo(() => {
    if (!posts) return [];
    return [...posts]
      .filter((post) => !blockedUserIds.includes(post.author.id))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [posts, blockedUserIds]);

  // Transform posts to legacy format
  const activityPosts = useMemo(() => {
    return sortedPosts.map(transformPostToActivityPost);
  }, [sortedPosts]);

  const ownPostIds = useMemo(() => {
    if (currentUser?.id == null) return new Set<string>();
    return new Set(
      sortedPosts.filter((p) => p.author.id === currentUser.id).map((p) => p.id.toString())
    );
  }, [sortedPosts, currentUser]);

  const isOwner = isOwnerResolved;

  // Check if current user is a member
  const isMember = useMemo(() => {
    if (!club || !currentUser || !club.members) return false;
    if (currentUser.id !== undefined) {
      return club.members.some((member) => Number(member.id) === Number(currentUser.id));
    }
    return club.members.some(
      (member) => member.name === currentUser.name && member.last_name === currentUser.last_name
    );
  }, [club, currentUser]);

  const handleJoinLeave = useCallback(async () => {
    if (!club) return;

    try {
      if (isMember) {
        await leaveClubMutation.mutateAsync(club.id);
      } else if (club.visibility === 'private') {
        await requestJoinMutation.mutateAsync(club.id);
        setJoinRequestPending(true);
      } else {
        await joinClubMutation.mutateAsync(club.id);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : '';
      if (msg.toLowerCase().includes('already')) {
        // User already has a pending request or is already a member
        setJoinRequestPending(true);
        showAlert('groups:clubs.requestAlreadyPendingTitle', 'groups:clubs.requestAlreadyPendingMessage');
      } else if (msg.toLowerCase().includes('private')) {
        // joinClub was called but club is actually private (stale visibility cache).
        // Retry as a join request instead.
        try {
          await requestJoinMutation.mutateAsync(club.id);
          setJoinRequestPending(true);
        } catch (retryError) {
          const retryMsg = retryError instanceof Error ? retryError.message : '';
          if (retryMsg.toLowerCase().includes('already')) {
            setJoinRequestPending(true);
            showAlert('groups:clubs.requestAlreadyPendingTitle', 'groups:clubs.requestAlreadyPendingMessage');
          } else {
            console.error('Failed to request join after private club error:', retryError);
            showAlert('alerts:error.title', 'alerts:error.generic');
          }
        }
      } else {
        console.error('Failed to join/leave club:', error);
        showAlert('alerts:error.title', 'alerts:error.generic');
      }
    }
  }, [club, isMember, joinClubMutation, leaveClubMutation, requestJoinMutation]);

  const handleRemoveMember = useCallback(
    (memberName: string, userId: number) => {
      Alert.alert(
        t('clubs.removeMemberTitle'),
        t('clubs.removeMemberMessage', { name: memberName }),
        [
          { text: t('common:buttons.cancel', 'Cancel'), style: 'cancel' },
          {
            text: t('common:buttons.remove', 'Remove'),
            style: 'destructive',
            onPress: async () => {
              try {
                await removeMemberMutation.mutateAsync(userId);
              } catch {
                showAlert('alerts:error.title', 'groups:clubs.removeMemberError');
              }
            },
          },
        ]
      );
    },
    [removeMemberMutation, t]
  );

  const handleCreatePost = useCallback(() => {
    if (!club) return;
    router.push(`/posts/create?clubId=${club.id}`);
  }, [club]);

  const handleEditClub = useCallback(() => {
    if (!club) return;
    router.push(`/clubs/edit?id=${club.id}`);
  }, [club]);

  const handleShareClub = useCallback(async () => {
    if (!club?.share_url) return;
    try {
      await Share.share({
        title: t('clubs.shareTitle', { clubName: club.name }),
        message: Platform.OS === 'android'
          ? `${t('clubs.shareMessage', { clubName: club.name })}\n${club.share_url}`
          : t('clubs.shareMessage', { clubName: club.name }),
        url: Platform.OS === 'ios' ? club.share_url : undefined,
      });
    } catch (error) {
      console.error('Share failed:', error);
    }
  }, [club, t]);

  const handleLike = useCallback((postId: string) => {
    // Find the backend post to get club_id and is_liked
    const post = sortedPosts.find((p) => p.id.toString() === postId);
    if (!post) return;

    toggleLike({
      clubId: post.club_id,
      postId: post.id,
      isLiked: post.is_liked,
    });
  }, [sortedPosts, toggleLike]);

  const handleComment = useCallback((postId: string) => {
    router.push(`/feed/post-detail?id=${postId}`);
  }, []);

  const handleUserPress = useCallback((userId: string) => {
    const post = sortedPosts.find((p) => p.author.name === userId);
    const name = post ? `${post.author.name} ${post.author.last_name}`.trim() : userId;
    const avatar = post?.author.profile_picture ?? undefined;
    router.push({ pathname: '/profile/[id]', params: { id: userId, name, avatar } });
  }, [sortedPosts]);

  const [photoViewer, setPhotoViewer] = useState<{ photos: string[]; index: number } | null>(null);

  const handlePhotoPress = useCallback((photos: string[], index: number) => {
    setPhotoViewer({ photos, index });
  }, []);

  const [moderationTarget, setModerationTarget] = useState<ModerationTarget | null>(null);

  const handleOptionsPress = useCallback((postId: string) => {
    const post = sortedPosts.find((p) => p.id.toString() === postId);
    if (!post) return;
    setModerationTarget({
      postId: post.id,
      authorId: post.author.id,
      authorName: `${post.author.name} ${post.author.last_name}`.trim(),
      clubName: post.club,
    });
  }, [sortedPosts]);

  const renderPost = useCallback(
    ({ item }: { item: ActivityPost }) => (
      <FeedPost
        post={item}
        onLike={handleLike}
        onComment={handleComment}
        onUserPress={handleUserPress}
        onPhotoPress={handlePhotoPress}
        onOptionsPress={ownPostIds.has(item.id) ? undefined : handleOptionsPress}
      />
    ),
    [handleLike, handleComment, handleUserPress, handlePhotoPress, handleOptionsPress, ownPostIds]
  );

  // Members (not owners) get Leave in a menu rather than as a big button.
  const memberMenuRef = useRef<View>(null);
  const [memberMenuAnchor, setMemberMenuAnchor] = useState<GlassMenuAnchor | null>(null);
  const openMemberMenu = () => {
    memberMenuRef.current?.measureInWindow((x, y, width, height) => {
      setMemberMenuAnchor({ x, y, width, height });
    });
  };

  const openMenu = () => {
    moreRef.current?.measureInWindow((x, y, width, height) => {
      setMenuAnchor({ x, y, width, height });
    });
  };

  const pendingCount = joinRequests?.length ?? 0;

  if (isLoading || !club) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.backgroundSecondary }]}>
        <View style={[styles.loading, { paddingTop: insets.top + 56 }]}>
          {isLoading ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : (
            <ThemedText>{t('clubs.notFoundMessage', 'This group does not exist.')}</ThemedText>
          )}
        </View>
        <ClubScreenHeader
          title={isLoading ? t('clubs.loading', 'Loading...') : t('clubs.notFound', 'Group Not Found')}
        />
      </View>
    );
  }

  const isPrivateClub = club.visibility === 'private';
  const mutationPending =
    joinClubMutation.isPending || leaveClubMutation.isPending || requestJoinMutation.isPending;

  const menuOptions = [
    { key: 'edit' as ClubMenuKey, label: t('clubs.editClub', 'Edit Group'), icon: <PencilSquareIcon size={18} color={colors.glassTint} /> },
    {
      key: 'requests' as ClubMenuKey,
      label:
        pendingCount > 0
          ? `${t('clubs.pendingRequests', 'Pending Requests')} (${pendingCount})`
          : t('clubs.pendingRequests', 'Pending Requests'),
      icon: <UserPlusIcon size={18} color={colors.glassTint} />,
    },
  ];

  const headerElement = (
    <View>
      {/* Title over the photo; scrolls with the content */}
      <View style={[styles.heroTitle, { height: heroHeight - SHEET_OVERLAP }]}>
        <ThemedText style={styles.clubName} numberOfLines={2}>
          {club.name}
        </ThemedText>
        <View style={styles.chips}>
          <View style={styles.heroChip}>
            <UsersIcon size={13} color="#FFFFFF" />
            <ThemedText style={styles.heroChipText}>
              {t('clubs.memberCount', { count: club.members?.length ?? 0 })}
            </ThemedText>
          </View>
          <View style={styles.heroChip}>
            {isPrivateClub ? (
              <LockClosedIcon size={13} color="#FFFFFF" />
            ) : (
              <GlobeAltIcon size={13} color="#FFFFFF" />
            )}
            <ThemedText style={styles.heroChipText}>
              {isPrivateClub ? t('clubs.private', 'Private') : t('clubs.public', 'Public')}
            </ThemedText>
          </View>
        </View>
      </View>
      <View style={[styles.sheet, { backgroundColor: colors.backgroundSecondary }]}>
        {club.description ? (
          <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
            <ThemedText style={[styles.aboutLabel, { color: colors.textSecondary }]}>
              {t('clubs.about', { defaultValue: 'About' })}
            </ThemedText>
            <ThemedText style={[styles.clubDescription, { color: colors.text }]}>{club.description}</ThemedText>
          </View>
        ) : null}

        {/* Actions: one clear primary pill, secondary actions as round glass buttons */}
        <View style={styles.actions}>
          {isMember ? (
            <View style={styles.actionRow}>
              <View style={styles.actionFlex}>
                <Button
                  title={t('clubs.newPost', { defaultValue: 'New post' })}
                  size="large"
                  fullWidth
                  icon={<PlusIcon size={20} color="#FFFFFF" />}
                  onPress={handleCreatePost}
                  style={styles.actionPill}
                />
              </View>
              <GlassButton
                onPress={() => router.push(`/posts/share-trip?clubId=${club.id}`)}
                accessibilityLabel={t('clubs.shareTrip', 'Share Trip')}
                size={ACTION_SIZE}
              >
                <MapIcon size={22} color={colors.glassTint} />
              </GlassButton>
              {!isOwner && (
                <View ref={memberMenuRef} collapsable={false}>
                  <GlassButton
                    onPress={openMemberMenu}
                    accessibilityLabel={t('clubs.moreActions', { defaultValue: 'More actions' })}
                    size={ACTION_SIZE}
                  >
                    {mutationPending ? (
                      <ActivityIndicator size="small" color={colors.glassTint} />
                    ) : (
                      <EllipsisHorizontalIcon size={22} color={colors.glassTint} />
                    )}
                  </GlassButton>
                </View>
              )}
            </View>
          ) : joinRequestPending ? (
            <Button
              title={t('clubs.requestPending', 'Requested')}
              variant="glass"
              size="large"
              fullWidth
              disabled
              icon={<ClockIcon size={18} color={colors.textSecondary} />}
              onPress={handleJoinLeave}
              style={styles.actionPill}
            />
          ) : (
            <Button
              title={isPrivateClub ? t('clubs.requestJoin', 'Request to Join') : t('clubs.join', 'Join Group')}
              size="large"
              fullWidth
              loading={mutationPending}
              icon={
                isPrivateClub ? (
                  <LockClosedIcon size={18} color="#FFFFFF" />
                ) : (
                  <UserPlusIcon size={20} color="#FFFFFF" />
                )
              }
              onPress={handleJoinLeave}
              style={styles.actionPill}
            />
          )}
        </View>

        {/* Members */}
        {club.members && club.members.length > 0 && (
          <SettingsGroup title={t('clubs.members', 'Members')} index={1}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.membersList}
            >
              {club.members.slice(0, 10).map((member, index) => {
                const isClubOwner = member.id === club.owner.id;
                const canRemove = isOwner && !isClubOwner;
                return (
                  <Pressable
                    key={index}
                    style={styles.memberItem}
                    onLongPress={
                      canRemove
                        ? () => handleRemoveMember(`${member.name} ${member.last_name}`, member.id)
                        : undefined
                    }
                  >
                    {member.profile_picture ? (
                      <Image source={{ uri: member.profile_picture }} style={styles.memberAvatar} />
                    ) : (
                      <View style={[styles.memberAvatar, styles.memberAvatarPlaceholder, { backgroundColor: colors.glassHighlight }]}>
                        <ThemedText style={styles.memberInitial}>{member.name.charAt(0).toUpperCase()}</ThemedText>
                      </View>
                    )}
                    <ThemedText style={[styles.memberName, { color: colors.textSecondary }]} numberOfLines={1}>
                      {member.name}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>
            {isOwner && (
              <SettingsItem
                grouped
                isFirst
                isLast
                icon={<UserPlusIcon size={22} color={colors.glassTint} />}
                title={t('clubs.pendingRequestsButton', 'View join requests')}
                value={pendingCount > 0 ? String(pendingCount) : undefined}
                onPress={() => router.push(`/clubs/pending-requests?id=${club.id}`)}
              />
            )}
          </SettingsGroup>
        )}

        {/* Posts header */}
        <Text style={[styles.sectionCaption, { color: colors.textSecondary }]}>
          {t('clubs.posts', 'Posts').toUpperCase()}
        </Text>
      </View>
    </View>
  );

  const emptyElement = (
    <View style={styles.emptyWrap}>
      <ClubEmptyState
        icon={
          isMember ? (
            <ChatBubbleLeftRightIcon size={30} color={colors.glassTint} />
          ) : (
            <LockClosedIcon size={30} color={colors.glassTint} />
          )
        }
        title={
          isMember
            ? t('clubs.noPosts', 'No posts yet. Be the first to post!')
            : t('clubs.joinToSeePosts', 'Join this group to see posts')
        }
      />
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.backgroundSecondary }]}>
      {/* Hero */}
      <Animated.View style={[styles.hero, { height: heroHeight }, heroAnimatedStyle]}>
        {club.photo ? (
          <Image source={{ uri: club.photo }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <LinearGradient
            colors={[colors.glassActiveFill, colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, styles.heroPlaceholder]}
          >
            <UsersIcon size={72} color="rgba(255,255,255,0.35)" />
          </LinearGradient>
        )}
        {/* Scrims keep the floating buttons and the title readable on any photo */}
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0)']}
          style={[styles.scrimTop, { height: insets.top + 72 }]}
        />
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.6)']}
          style={styles.scrimBottom}
        />
      </Animated.View>

      <Animated.FlatList
        data={isMember ? activityPosts : []}
        renderItem={({ item }) => <View style={styles.postWrap}>{renderPost({ item })}</View>}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={headerElement}
        ListEmptyComponent={emptyElement}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              refetch();
              refetchPosts();
            }}
            tintColor={colors.primary}
            progressViewOffset={insets.top}
          />
        }
      />

      {/* Status bar backdrop once the hero is gone */}
      <Animated.View
        pointerEvents="none"
        style={[styles.statusBackdrop, { height: insets.top, backgroundColor: colors.backgroundSecondary }, statusBackdropStyle]}
      />

      {/* Compact glass title pill */}
      <View
        pointerEvents="none"
        style={[
          styles.pillWrap,
          {
            top: insets.top + 8,
            left: 16 + BUTTON_SIZE + 8,
            right: 16 + (isOwner ? 2 : 1) * (BUTTON_SIZE + 8),
          },
        ]}
      >
        <Animated.View style={[styles.pill, pillAnimatedStyle]}>
          <GlassSurface borderRadius={BUTTON_SIZE / 2} />
          <ThemedText style={styles.pillText} numberOfLines={1}>
            {club.name}
          </ThemedText>
        </Animated.View>
      </View>

      {/* Floating glass controls */}
      <GlassButton
        onPress={() => router.back()}
        accessibilityLabel={t('common:buttons.back')}
        size={BUTTON_SIZE}
        style={[styles.floating, { top: insets.top + 8, left: 16 }]}
      >
        <ChevronLeftIcon size={22} color={colors.glassInactive} />
      </GlassButton>
      <View style={[styles.floatingRight, { top: insets.top + 8 }]}>
        <GlassButton
          onPress={handleShareClub}
          accessibilityLabel={t('clubs.share', 'Invite')}
          size={BUTTON_SIZE}
        >
          <ShareIcon size={20} color={colors.glassInactive} />
        </GlassButton>
        {isOwner && (
          <View ref={moreRef} collapsable={false}>
            <GlassButton
              onPress={openMenu}
              accessibilityLabel={t('clubs.moreActions', { defaultValue: 'More actions' })}
              size={BUTTON_SIZE}
            >
              <EllipsisHorizontalIcon size={22} color={colors.glassInactive} />
              {pendingCount > 0 && <View style={[styles.menuDot, { backgroundColor: colors.error }]} />}
            </GlassButton>
          </View>
        )}
      </View>

      {!isOwner && isMember && (
        <GlassMenu<'leave' | 'none'>
          anchor={memberMenuAnchor}
          options={[
            {
              key: 'leave',
              label: t('clubs.leave', 'Leave Group'),
              icon: <ArrowLeftStartOnRectangleIcon size={18} color={colors.error} />,
            },
          ]}
          selected="none"
          onSelect={() => {
            setMemberMenuAnchor(null);
            handleJoinLeave();
          }}
          onClose={() => setMemberMenuAnchor(null)}
        />
      )}

      {isOwner && (
        <GlassMenu<ClubMenuKey>
          anchor={menuAnchor}
          options={menuOptions}
          selected="none"
          onSelect={(key) => {
            setMenuAnchor(null);
            if (key === 'edit') handleEditClub();
            else if (key === 'requests') router.push(`/clubs/pending-requests?id=${club.id}`);
          }}
          onClose={() => setMenuAnchor(null)}
        />
      )}

      <Modal
        visible={photoViewer != null}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoViewer(null)}
      >
        <TouchableOpacity
          style={styles.photoViewerOverlay}
          activeOpacity={1}
          onPress={() => setPhotoViewer(null)}
        >
          {photoViewer && (
            <Image
              source={{ uri: photoViewer.photos[photoViewer.index] }}
              style={styles.photoViewerImage}
              resizeMode="contain"
            />
          )}
        </TouchableOpacity>
      </Modal>
      <PostModerationSheet
        visible={moderationTarget != null}
        target={moderationTarget}
        onClose={() => setModerationTarget(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden', transformOrigin: 'top' },
  scrimTop: { position: 'absolute', top: 0, left: 0, right: 0 },
  scrimBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%' },
  heroTitle: { justifyContent: 'flex-end', paddingHorizontal: 20, paddingBottom: 20, gap: 10 },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  heroChipText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  aboutLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  heroPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  sheet: {
    borderTopLeftRadius: SHEET_OVERLAP,
    borderTopRightRadius: SHEET_OVERLAP,
    paddingTop: 20,
  },
  infoCard: { marginHorizontal: 16, marginBottom: 12, borderRadius: 20, padding: 16, gap: 12 },
  clubName: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  clubDescription: { fontSize: 15, lineHeight: 22 },
  actions: { paddingHorizontal: 16, gap: 12, marginBottom: 24 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actionFlex: { flex: 1 },
  actionPill: { borderRadius: 999, minHeight: ACTION_SIZE },
  membersList: { gap: 16, paddingHorizontal: 16, paddingVertical: 14 },
  memberItem: { alignItems: 'center', gap: 6, width: 60 },
  memberAvatar: { width: 50, height: 50, borderRadius: 25 },
  memberAvatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  memberInitial: { fontSize: 18, fontWeight: '600' },
  memberName: { fontSize: 12, textAlign: 'center' },
  sectionCaption: {
    fontSize: 12,
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: 32,
  },
  postWrap: { paddingHorizontal: 16 },
  emptyWrap: { paddingHorizontal: 16 },
  statusBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5 },
  floating: { position: 'absolute', zIndex: 10 },
  floatingRight: { position: 'absolute', right: 16, zIndex: 10, flexDirection: 'row', gap: 8 },
  menuDot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4 },
  pillWrap: { position: 'absolute', alignItems: 'center', zIndex: 6 },
  pill: {
    height: BUTTON_SIZE,
    maxWidth: '100%',
    paddingHorizontal: 18,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  photoViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoViewerImage: { width: '100%', height: '70%' },
});
