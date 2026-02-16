import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import {
  PaperAirplaneIcon,
  HeartIcon as HeartIconOutline,
} from 'react-native-heroicons/outline';
import { HeartIcon as HeartIconSolid } from 'react-native-heroicons/solid';
import { useTranslation } from 'react-i18next';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { Spacing } from '@/constants/theme';
import { UserAvatar, PhotoGallery } from '@/components/feed';
import { useAddComment, usePost, useTogglePostLike } from '@/lib/hooks/usePosts';
import { useInfiniteFeed } from '@/lib/hooks/useFeed';
import Header from '@/components/layout/Header';

export default function PostDetailScreen() {
  const { t } = useTranslation('groups');
  const { colors } = useTheme();
  const { id, clubId } = useLocalSearchParams<{ id: string; clubId?: string }>();

  const [commentText, setCommentText] = useState('');

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

  const handlePostComment = useCallback(async () => {
    if (!commentText.trim() || !post) return;

    try {
      await addCommentMutation.mutateAsync({
        clubId: post.club_id,
        postId: post.id,
        text: commentText.trim(),
      });

      setCommentText('');
    } catch (error) {
      console.error('Failed to post comment:', error);
      alert(error instanceof Error ? error.message : 'Failed to post comment');
    }
  }, [commentText, post, addCommentMutation]);

  const formatTimeAgo = (timestamp: string): string => {
    const now = new Date();
    const commentDate = new Date(timestamp);
    const diffMs = now.getTime() - commentDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

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

  if (isLoading) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: colors.background }]}
        edges={['top', 'bottom']}
      >
        <Header title={t('feed.post', 'Post')} showBack />
        <ThemedView style={styles.container}>
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        </ThemedView>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: colors.background }]}
        edges={['top', 'bottom']}
      >
        <Header title={t('feed.post', 'Post')} showBack />
        <ThemedView style={styles.container}>
          <View style={styles.loading}>
            <ThemedText>{t('feed.postNotFound', 'Post not found')}</ThemedText>
          </View>
        </ThemedView>
      </SafeAreaView>
    );
  }

  const headerTitle = post.club || t('feed.post', 'Post');

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['top', 'bottom']}
    >
      <Header title={headerTitle} showBack />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
            {/* Post Header */}
            <View style={styles.postHeader}>
              <UserAvatar
                name={`${post.author.name} ${post.author.last_name}`}
                imageUri={post.author.profile_picture || undefined}
                size={48}
              />
              <View style={styles.headerInfo}>
                <ThemedText style={styles.userName}>
                  {post.author.name} {post.author.last_name}
                </ThemedText>
                <ThemedText style={[styles.timestamp, { color: colors.textMuted }]}>
                  {formatTimeAgo(post.created_at)}
                </ThemedText>
              </View>
            </View>

            {/* Post Title */}
            <ThemedText style={styles.postTitle}>{post.title}</ThemedText>

            {/* Photos */}
            {post.photos.length > 0 && (
              <PhotoGallery photos={post.photos.map((p) => p.image || '')} />
            )}

            {/* Post Content */}
            <ThemedText style={[styles.postText, { color: colors.textSecondary }]}>
              {post.text}
            </ThemedText>

            {/* Trip Stats (if available) */}
            {post.trip && (
              <View style={[styles.tripStats, { backgroundColor: colors.card }]}>
                <View style={styles.stat}>
                  <ThemedText style={[styles.statLabel, { color: colors.textMuted }]}>
                    {t('feed.distance', 'Distance')}
                  </ThemedText>
                  <ThemedText style={styles.statValue}>
                    {formatDistance(post.trip.distance)}
                  </ThemedText>
                </View>
                <View style={styles.stat}>
                  <ThemedText style={[styles.statLabel, { color: colors.textMuted }]}>
                    {t('feed.duration', 'Duration')}
                  </ThemedText>
                  <ThemedText style={styles.statValue}>
                    {formatDuration(post.trip.duration)}
                  </ThemedText>
                </View>
                <View style={styles.stat}>
                  <ThemedText style={[styles.statLabel, { color: colors.textMuted }]}>
                    {t('feed.type', 'Type')}
                  </ThemedText>
                  <ThemedText style={styles.statValue}>
                    {post.trip.type.charAt(0).toUpperCase() + post.trip.type.slice(1)}
                  </ThemedText>
                </View>
              </View>
            )}

            {/* Post Actions */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.actionButton}
                activeOpacity={0.7}
                onPress={() => toggleLike.mutate({
                  clubId: post.club_id,
                  postId: post.id,
                  isLiked: post.is_liked,
                })}
              >
                {post.is_liked ? (
                  <HeartIconSolid size={24} color="#EF4444" />
                ) : (
                  <HeartIconOutline size={24} color={colors.textMuted} />
                )}
                <ThemedText style={[styles.actionText, { color: colors.textMuted }]}>
                  {post.likes_count} {post.likes_count === 1 ? t('feed.like', 'Like') : t('feed.likes', 'Likes')}
                </ThemedText>
              </TouchableOpacity>
            </View>

            {/* Comments Section */}
            <View style={[styles.commentsSection, { borderTopColor: colors.border }]}>
              <ThemedText style={styles.commentsTitle}>
                {t('feed.comments', 'Comments')} ({post.comment_count})
              </ThemedText>

              {post.comments && post.comments.length > 0 ? (
                <View style={styles.commentsList}>
                  {post.comments.map((comment) => (
                    <View key={comment.id} style={[styles.commentItem, { borderBottomColor: colors.border }]}>
                      <UserAvatar
                        name={`${comment.author.name} ${comment.author.last_name}`}
                        imageUri={comment.author.profile_picture || undefined}
                        size={36}
                      />
                      <View style={styles.commentContent}>
                        <View style={styles.commentHeader}>
                          <ThemedText style={styles.commentAuthor}>
                            {comment.author.name} {comment.author.last_name}
                          </ThemedText>
                          <ThemedText style={[styles.commentTime, { color: colors.textMuted }]}>
                            {formatTimeAgo(comment.created_at)}
                          </ThemedText>
                        </View>
                        <ThemedText style={[styles.commentText, { color: colors.textSecondary }]}>
                          {comment.text}
                        </ThemedText>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <ThemedText style={[styles.emptyComments, { color: colors.textMuted }]}>
                  {t('feed.noComments', 'No comments yet. Be the first to comment!')}
                </ThemedText>
              )}
            </View>
          </ScrollView>

          {/* Comment Input */}
          <View style={[styles.commentInputContainer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
            <TextInput
              style={[styles.commentInput, { color: colors.text }]}
              placeholder={t('feed.addComment', 'Add a comment...')}
              placeholderTextColor={colors.textMuted}
              value={commentText}
              onChangeText={setCommentText}
              multiline
              maxLength={500}
              editable={!addCommentMutation.isPending}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!commentText.trim() || addCommentMutation.isPending) && styles.sendButtonDisabled,
              ]}
              onPress={handlePostComment}
              disabled={!commentText.trim() || addCommentMutation.isPending}
              activeOpacity={0.7}
            >
              {addCommentMutation.isPending ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <PaperAirplaneIcon
                  size={20}
                  color={commentText.trim() ? colors.primary : colors.textMuted}
                />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  headerInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 12,
  },
  postTitle: {
    fontSize: 20,
    fontWeight: '700',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  postText: {
    fontSize: 16,
    lineHeight: 24,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
  },
  tripStats: {
    flexDirection: 'row',
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    borderRadius: 12,
    gap: Spacing.lg,
  },
  stat: {
    flex: 1,
    gap: Spacing.xs,
  },
  statLabel: {
    fontSize: 12,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.lg,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  commentsSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    gap: Spacing.md,
  },
  commentsTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptyComments: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  commentsList: {
    gap: Spacing.md,
  },
  commentItem: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  commentContent: {
    flex: 1,
    gap: Spacing.xs,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '600',
  },
  commentTime: {
    fontSize: 12,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    gap: Spacing.md,
  },
  commentInput: {
    flex: 1,
    fontSize: 16,
    maxHeight: 100,
    paddingVertical: Spacing.xs,
  },
  sendButton: {
    padding: Spacing.sm,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
