import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View, RefreshControl, ActivityIndicator, Modal, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { Spacing, FontSizes } from '@/constants/theme';
import {
  FeedHeader,
  FeedPost,
} from '@/components/feed';
import type { ActivityPost, Post } from '@/types/feed';
import { useInfiniteFeed } from '@/lib/hooks/useFeed';
import { useTogglePostLike } from '@/lib/hooks/usePosts';
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

export default function FeedScreen() {
  const { t } = useTranslation('groups');
  const { colors } = useTheme();

  // Fetch data from API
  const {
    data: feedData,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    isRefetching,
  } = useInfiniteFeed();

  // Like mutation
  const { mutate: toggleLike } = useTogglePostLike();

  // Store raw backend posts for like handler
  const backendPosts = useMemo(() => {
    if (!feedData?.pages) return [];
    return feedData.pages.flatMap((page) => page.results);
  }, [feedData]);

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

  const renderPost = useCallback(
    ({ item }: { item: ActivityPost }) => (
      <FeedPost
        post={item}
        onLike={handleLike}
        onComment={handleComment}
        onUserPress={handleUserPress}
        onPhotoPress={handlePhotoPress}
      />
    ),
    [handleLike, handleComment, handleUserPress, handlePhotoPress]
  );

  const renderEmptyState = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <ThemedText style={[styles.emptyMessage, { color: colors.textMuted }]}>
            {t('feed.loading', 'Loading feed...')}
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

        <FlatList
          data={posts}
          renderItem={renderPost}
          keyExtractor={(item) => item.id}
          ListFooterComponent={renderFooter}
          contentContainerStyle={[
            styles.listContent,
            posts.length === 0 && styles.emptyListContent,
          ]}
          showsVerticalScrollIndicator={false}
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
  photoViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoViewerImage: {
    width: '100%',
    height: '70%',
  },
});
