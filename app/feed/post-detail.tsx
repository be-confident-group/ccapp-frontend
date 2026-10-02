import React, { useState, useCallback, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  ChatBubbleLeftRightIcon,
  ChatBubbleOvalLeftIcon,
  DocumentTextIcon,
  EllipsisHorizontalIcon,
  HeartIcon as HeartIconOutline,
} from 'react-native-heroicons/outline';
import { HeartIcon as HeartIconSolid } from 'react-native-heroicons/solid';
import { useTranslation } from 'react-i18next';
import { GlassButton } from '@/components/ui/GlassButton';
import { PostsScreen } from '@/components/posts/PostsScreen';
import { PostsEmptyState } from '@/components/posts/PostsEmptyState';
import { PressableScale } from '@/components/posts/PressableScale';
import { FadeInUp } from '@/components/posts/FadeInUp';
import { CommentComposer } from '@/components/posts/CommentComposer';
import { SettingsGroup } from '@/components/profile/SettingsGroup';
import { useTheme } from '@/contexts/ThemeContext';
import { UserAvatar, PhotoGallery, PhotoViewer, PostModerationSheet } from '@/components/feed';
import type { ModerationTarget } from '@/components/feed';
import { useAddComment, usePost, useTogglePostLike } from '@/lib/hooks/usePosts';
import { useInfiniteFeed } from '@/lib/hooks/useFeed';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { useBlockedUsers } from '@/lib/hooks/useBlockedUsers';
import { containsObjectionableContent } from '@/lib/utils/contentFilter';
import { showAlert } from '@/lib/utils/alert';

export default function PostDetailScreen() {
  const { t } = useTranslation('groups');
  const { colors } = useTheme();
  const { id, clubId } = useLocalSearchParams<{ id: string; clubId?: string }>();

  const [commentText, setCommentText] = useState('');
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  // First get basic post info from feed to find clubId
  const { data: feedData } = useInfiniteFeed();

  // Find the post from feed data to get clubId
  const feedPost = useMemo(() => {
    if (!feedData?.pages || !id) return null;

    for (const page of feedData.pages) {
      const found = page.results.find((p) => p.id.toString() === id);
      if (found) return found;
    }
    return null;
  }, [feedData, id]);

  // Use clubId from route params or from feed post
  const resolvedClubId = clubId ? parseInt(clubId, 10) : feedPost?.club_id;
  const postId = id ? parseInt(id, 10) : 0;

  // Fetch full post with comments using usePost
  const { data: post, isLoading } = usePost(resolvedClubId || 0, postId);

  const addCommentMutation = useAddComment();
  const toggleLike = useTogglePostLike();

  const { data: currentUser } = useCurrentUser();
  const { data: blockedUserIds = [] } = useBlockedUsers();
  const [moderationTarget, setModerationTarget] = useState<ModerationTarget | null>(null);

  const visibleComments = useMemo(() => {
    return (post?.comments ?? []).filter((c) => !blockedUserIds.includes(c.author.id));
  }, [post?.comments, blockedUserIds]);

  const isOwnPost = post != null && currentUser?.id != null && post.author.id === currentUser.id;

  const handleOptionsPress = useCallback(() => {
    if (!post) return;
    setModerationTarget({
      postId: post.id,
      authorId: post.author.id,
      authorName: `${post.author.name} ${post.author.last_name}`.trim(),
      clubName: post.club,
    });
  }, [post]);

  const handlePostComment = useCallback(async () => {
    if (!commentText.trim() || !post) return;

    if (containsObjectionableContent(commentText)) {
      showAlert('alerts:moderation.contentBlockedTitle', 'alerts:moderation.contentBlockedMessage');
      return;
    }

    try {
      await addCommentMutation.mutateAsync({
        clubId: post.club_id,
        postId: post.id,
        text: commentText.trim(),
      });

      setCommentText('');
    } catch (error) {
      console.error('Failed to post comment:', error);
      alert(error instanceof Error ? error.message : t('feed.commentFailed', { defaultValue: 'Failed to post comment' }));
    }
  }, [commentText, post, addCommentMutation, t]);

  const formatTimeAgo = (timestamp: string): string => {
    const now = new Date();
    const commentDate = new Date(timestamp);
    const diffMs = now.getTime() - commentDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('feed.justNow', { defaultValue: 'Just now' });
    if (diffMins < 60) return t('feed.minutesAgo', { count: diffMins, defaultValue: '{{count}}m ago' });
    if (diffHours < 24) return t('feed.hoursAgo', { count: diffHours, defaultValue: '{{count}}h ago' });
    if (diffDays < 7) return t('feed.daysAgo', { count: diffDays, defaultValue: '{{count}}d ago' });

    return commentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatDistance = (km: number): string => {
    return km < 1 ? `${(km * 1000).toFixed(0)}m` : `${km.toFixed(1)}km`;
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const title = t('feed.post', 'Post');

  if (isLoading) {
    return (
      <PostsScreen title={title} scroll={false}>
        <ActivityIndicator size="large" color={colors.primary} />
      </PostsScreen>
    );
  }

  if (!post) {
    return (
      <PostsScreen title={title} scroll={false}>
        <PostsEmptyState
          icon={(color) => <DocumentTextIcon size={28} color={color} />}
          text={t('feed.postNotFound', 'Post not found')}
        />
      </PostsScreen>
    );
  }

  const photoUris = post.photos.map((p) => p.image || '');

  return (
    <>
      <PostsScreen
        title={post.club || title}
        keyboardAvoiding
        footerVariant="floating"
        headerRight={
          !isOwnPost ? (
            <GlassButton
              size={40}
              onPress={handleOptionsPress}
              accessibilityLabel={t('moderation.postOptions')}
            >
              <EllipsisHorizontalIcon size={22} color={colors.glassInactive} />
            </GlassButton>
          ) : undefined
        }
        footer={
          <CommentComposer
            value={commentText}
            onChangeText={setCommentText}
            onSend={handlePostComment}
            pending={addCommentMutation.isPending}
            placeholder={t('feed.addComment', 'Add a comment...')}
            sendLabel={t('feed.sendComment', { defaultValue: 'Send comment' })}
          />
        }
      >
        {/* Post card */}
        <FadeInUp index={0} style={styles.section}>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.authorRow}>
              <UserAvatar
                name={`${post.author.name} ${post.author.last_name}`}
                imageUri={post.author.profile_picture || undefined}
                size={44}
              />
              <View style={styles.authorInfo}>
                <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
                  {post.author.name} {post.author.last_name}
                </Text>
                <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
                  {formatTimeAgo(post.created_at)}
                </Text>
              </View>
            </View>

            <Text style={[styles.postTitle, { color: colors.text }]}>{post.title}</Text>

            {photoUris.length > 0 && (
              <View style={styles.gallery}>
                <PhotoGallery photos={photoUris} onPhotoPress={setViewerIndex} />
              </View>
            )}

            <Text style={[styles.postText, { color: colors.textSecondary }]}>{post.text}</Text>

            {post.trip && (
              <View style={[styles.tripStats, { backgroundColor: colors.backgroundSecondary }]}>
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
                    {formatDistance(post.trip.distance)}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    {t('feed.distance', 'Distance')}
                  </Text>
                </View>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
                    {formatDuration(post.trip.duration)}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    {t('feed.duration', 'Duration')}
                  </Text>
                </View>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
                    {post.trip.type.charAt(0).toUpperCase() + post.trip.type.slice(1)}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    {t('feed.type', 'Type')}
                  </Text>
                </View>
              </View>
            )}

            <View style={[styles.actions, { borderTopColor: colors.border }]}>
              <PressableScale
                style={styles.actionButton}
                accessibilityLabel={post.is_liked ? t('feed.like', 'Like') : t('feed.likes', 'Likes')}
                onPress={() =>
                  toggleLike.mutate({
                    clubId: post.club_id,
                    postId: post.id,
                    isLiked: post.is_liked,
                  })
                }
              >
                {post.is_liked ? (
                  <HeartIconSolid size={22} color={colors.error} />
                ) : (
                  <HeartIconOutline size={22} color={colors.glassTint} />
                )}
                <Text style={[styles.actionText, { color: colors.textSecondary }]}>
                  {post.likes_count} {post.likes_count === 1 ? t('feed.like', 'Like') : t('feed.likes', 'Likes')}
                </Text>
              </PressableScale>
              <View style={styles.actionButton}>
                <ChatBubbleOvalLeftIcon size={22} color={colors.glassTint} />
                <Text style={[styles.actionText, { color: colors.textSecondary }]}>{post.comment_count}</Text>
              </View>
            </View>
          </View>
        </FadeInUp>

        {/* Comments */}
        <SettingsGroup title={`${t('feed.comments', 'Comments')} (${post.comment_count})`} index={1}>
          {visibleComments.length > 0 ? (
            visibleComments.map((comment, i) => (
              <FadeInUp key={comment.id} index={Math.min(i, 6) + 2}>
                <View
                  style={[
                    styles.commentItem,
                    i < visibleComments.length - 1 && {
                      borderBottomColor: colors.border,
                      borderBottomWidth: StyleSheet.hairlineWidth,
                    },
                  ]}
                >
                  <UserAvatar
                    name={`${comment.author.name} ${comment.author.last_name}`}
                    imageUri={comment.author.profile_picture || undefined}
                    size={36}
                  />
                  <View style={styles.commentContent}>
                    <View style={styles.commentHeader}>
                      <Text style={[styles.commentAuthor, { color: colors.text }]} numberOfLines={1}>
                        {comment.author.name} {comment.author.last_name}
                      </Text>
                      <Text style={[styles.commentTime, { color: colors.textSecondary }]}>
                        {formatTimeAgo(comment.created_at)}
                      </Text>
                    </View>
                    <Text style={[styles.commentText, { color: colors.textSecondary }]}>{comment.text}</Text>
                  </View>
                </View>
              </FadeInUp>
            ))
          ) : (
            <View style={styles.emptyComments}>
              <View style={[styles.emptyCircle, { backgroundColor: colors.glassHighlight }]}>
                <ChatBubbleLeftRightIcon size={28} color={colors.glassTint} />
              </View>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {t('feed.noComments', 'No comments yet. Be the first to comment!')}
              </Text>
            </View>
          )}
        </SettingsGroup>
      </PostsScreen>

      <PhotoViewer
        visible={viewerIndex !== null}
        photos={photoUris}
        initialIndex={viewerIndex ?? 0}
        onClose={() => setViewerIndex(null)}
      />
      <PostModerationSheet
        visible={moderationTarget != null}
        target={moderationTarget}
        onClose={() => setModerationTarget(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 16, marginBottom: 24 },
  card: { borderRadius: 20, padding: 16, gap: 12 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  authorInfo: { flex: 1, gap: 2 },
  userName: { fontSize: 16, fontWeight: '600' },
  timestamp: { fontSize: 12 },
  postTitle: { fontSize: 20, fontWeight: '700' },
  gallery: { marginHorizontal: -16, marginVertical: -8 },
  postText: { fontSize: 16, lineHeight: 24 },
  tripStats: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, paddingVertical: 12 },
  stat: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: 6 },
  statValue: { fontSize: 17, fontWeight: '700' },
  statLabel: { fontSize: 12, fontWeight: '500' },
  divider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { fontSize: 14, fontWeight: '600' },
  commentItem: { flexDirection: 'row', gap: 12, padding: 16 },
  commentContent: { flex: 1, gap: 4 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  commentAuthor: { flex: 1, fontSize: 14, fontWeight: '600' },
  commentTime: { fontSize: 12 },
  commentText: { fontSize: 14, lineHeight: 20 },
  emptyComments: { alignItems: 'center', gap: 12, padding: 24 },
  emptyCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
