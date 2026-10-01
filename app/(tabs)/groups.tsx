import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { useTabBarInset, useTabBarScrollHandler } from '@/contexts/TabBarContext';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { Spacing, FontSizes } from '@/constants/theme';
import { GlassTextSegments } from '@/components/ui/GlassTextSegments';
import {
  FeedHeader,
  FeedPost,
  PhotoViewer,
  PostModerationSheet,
} from '@/components/feed';
import type { ModerationTarget } from '@/components/feed';
import type { ActivityPost, Post } from '@/types/feed';
import { useInfiniteFeed } from '@/lib/hooks/useFeed';
import type { FeedType } from '@/lib/api/feed';
import { useTogglePostLike } from '@/lib/hooks/usePosts';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { useBlockedUsers } from '@/lib/hooks/useBlockedUsers';
import { NewspaperIcon } from 'react-native-heroicons/outline';

// Helper function to transform backend Post to ActivityPost for legacy component
function transformPostToActivityPost(post: Post): ActivityPost {
  return {
    id: post.id.toString(),
    user: {
      id: post.author.name,
      name: `${post.author.name} ${post.author.last_name}`,
      avatarUrl: post.author.profile_picture || undefined,
    },
    location: undefined, // Not in backend schema
    photos: post.photos.map((p) => p.image || ''),
    title: post.title,
    caption: post.text,
    activityType: post.trip?.type === 'cycle' ? 'ride' : (post.trip?.type || 'walk') as 'walk' | 'ride' | 'run',
    distance: post.trip?.distance,
    duration: post.trip?.duration,
    likeCount: post.likes_count,
    commentCount: post.comment_count,
    isLiked: post.is_liked,
    createdAt: post.created_at,
    groupId: post.club_id.toString(),
  };
}

const FEED_FILTERS: { key: FeedType; labelKey: string }[] = [
  { key: 'all', labelKey: 'feed.filter.all' },
  { key: 'posts', labelKey: 'feed.filter.posts' },
  { key: 'activities', labelKey: 'feed.filter.activities' },
];

export default function FeedScreen() {
  const { t } = useTranslation('groups');
  const { colors } = useTheme();
  const tabBarScroll = useTabBarScrollHandler();
  const tabBarInset = useTabBarInset();

  const [feedType, setFeedType] = useState<FeedType>('all');

  // Fetch data from API
  const {
    data: feedData,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    isRefetching,
  } = useInfiniteFeed(20, feedType);

  // Like mutation
  const { mutate: toggleLike } = useTogglePostLike();

  const { data: currentUser } = useCurrentUser();
  const { data: blockedUserIds = [] } = useBlockedUsers();

  // Store raw backend posts for like handler — blocked authors are filtered
  // out here so their posts disappear from the feed on this device.
  const backendPosts = useMemo(() => {
    if (!feedData?.pages) return [];
    const all = feedData.pages.flatMap((page) => page.results);
    return all.filter((post) => !blockedUserIds.includes(post.author.id));
  }, [feedData, blockedUserIds]);

  const ownPostIds = useMemo(() => {
    if (currentUser?.id == null) return new Set<string>();
    return new Set(
      backendPosts.filter((p) => p.author.id === currentUser.id).map((p) => p.id.toString())
    );
  }, [backendPosts, currentUser]);

  // Transform backend data to legacy format
  const posts = useMemo(() => {
    return backendPosts.map(transformPostToActivityPost);
  }, [backendPosts]);

  const handleLeaderboardPress = useCallback(() => {
    router.push('/feed/leaderboards');
  }, []);

  const handleMyClubsPress = useCallback(() => {
    router.push('/clubs/my-clubs');
  }, []);

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const handleLike = useCallback((postId: string) => {
    // Find the backend post to get club_id and is_liked
    const post = backendPosts.find((p) => p.id.toString() === postId);
    if (!post) return;

    toggleLike({
      clubId: post.club_id,
      postId: post.id,
      isLiked: post.is_liked,
    });
  }, [backendPosts, toggleLike]);

  const handleComment = useCallback((postId: string) => {
    router.push(`/feed/post-detail?id=${postId}`);
  }, []);

  const handleUserPress = useCallback((userId: string) => {
    const post = backendPosts.find((p) => p.author.name === userId);
    const name = post ? `${post.author.name} ${post.author.last_name}`.trim() : userId;
    const avatar = post?.author.profile_picture ?? undefined;
    router.push({ pathname: '/profile/[id]', params: { id: userId, name, avatar } });
  }, [backendPosts]);

  const [photoViewer, setPhotoViewer] = useState<{ photos: string[]; index: number } | null>(null);

  const handlePhotoPress = useCallback((photos: string[], index: number) => {
    setPhotoViewer({ photos, index });
  }, []);

  const [moderationTarget, setModerationTarget] = useState<ModerationTarget | null>(null);

  const handleOptionsPress = useCallback((postId: string) => {
    const post = backendPosts.find((p) => p.id.toString() === postId);
    if (!post) return;
    setModerationTarget({
      postId: post.id,
      authorId: post.author.id,
      authorName: `${post.author.name} ${post.author.last_name}`.trim(),
      clubName: post.club,
    });
  }, [backendPosts]);

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

  const renderEmptyState = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <ThemedText style={[styles.emptyMessage, { color: colors.textMuted }]}>
            {t('feed.loading')}
          </ThemedText>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <NewspaperIcon size={64} color={colors.textMuted} />
        <ThemedText style={[styles.emptyTitle, { color: colors.textSecondary }]}>
          {t('empty.noPosts')}
        </ThemedText>
        <ThemedText style={[styles.emptyMessage, { color: colors.textMuted }]}>
          {t('empty.noPostsMessage')}
        </ThemedText>
      </View>
    );
  };

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <ThemedView style={styles.container}>
        <FeedHeader
          onLeaderboardPress={handleLeaderboardPress}
          onMyClubsPress={handleMyClubsPress}
        />

        <View style={styles.filterBar}>
          <GlassTextSegments
            items={FEED_FILTERS.map(({ key, labelKey }) => ({ key, label: t(labelKey) }))}
            value={feedType}
            onChange={setFeedType}
            fontSize={FontSizes.sm}
          />
        </View>

        <Animated.FlatList
          data={posts}
          renderItem={renderPost}
          keyExtractor={(item) => item.id}
          ListFooterComponent={renderFooter}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: tabBarInset },
            posts.length === 0 && styles.emptyListContent,
          ]}
          showsVerticalScrollIndicator={false}
          onScroll={tabBarScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={renderEmptyState}
        />
      </ThemedView>
      <PhotoViewer
        visible={photoViewer != null}
        photos={photoViewer?.photos ?? []}
        initialIndex={photoViewer?.index ?? 0}
        onClose={() => setPhotoViewer(null)}
      />
      <PostModerationSheet
        visible={moderationTarget != null}
        target={moderationTarget}
        onClose={() => setModerationTarget(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    paddingTop: Spacing.md,
  },
  emptyListContent: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl * 2,
    gap: Spacing.md,
  },
  emptyTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
  },
  emptyMessage: {
    fontSize: FontSizes.sm,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
  footer: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
});
