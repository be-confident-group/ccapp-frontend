import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ChevronLeftIcon,
  PaperAirplaneIcon,
  HeartIcon as HeartIconOutline,
  ChatBubbleOvalLeftIcon,
} from 'react-native-heroicons/outline';
import { HeartIcon as HeartIconSolid } from 'react-native-heroicons/solid';
import { useTranslation } from 'react-i18next';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { Spacing } from '@/constants/theme';
import { UserAvatar, PhotoGallery } from '@/components/feed';
import { mockPosts } from '@/lib/utils/mockFeedData';
import type { Comment } from '@/types/feed';

export default function PostDetailScreen() {
  const { t } = useTranslation('groups');
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [post, setPost] = useState(mockPosts.find((p) => p.id === id));
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<Comment[]>([
    {
      id: '1',
      user: {
        id: 'u10',
        name: 'Alex Kim',
      },
      text: 'Amazing ride! Wish I could join you next time.',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: '2',
      user: {
        id: 'u11',
        name: 'Sam Taylor',
      },
      text: 'Beautiful photos! What camera did you use?',
      createdAt: new Date(Date.now() - 7200000).toISOString(),
    },
  ]);

  const handleLike = useCallback(() => {
    if (!post) return;
    setPost({
      ...post,
      isLiked: !post.isLiked,
      likeCount: post.isLiked ? post.likeCount - 1 : post.likeCount + 1,
    });
  }, [post]);

  const handlePostComment = useCallback(() => {
    if (!commentText.trim()) return;

    const newComment: Comment = {
      id: `${Date.now()}`,
      user: {
        id: 'current-user',
        name: 'You',
      },
      text: commentText,
      createdAt: new Date().toISOString(),
    };

    setComments((prev) => [newComment, ...prev]);
    setCommentText('');
  }, [commentText]);

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

  if (!post) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
        <ThemedView style={styles.container}>
          <ThemedText>Post not found</ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ThemedView style={styles.container}>
          {/* Header */}
          <View
            style={[
              styles.header,
              { backgroundColor: colors.background, borderBottomColor: colors.border },
            ]}
          >
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <ChevronLeftIcon size={28} color={colors.text} />
            </TouchableOpacity>

            <ThemedText type="subtitle" style={styles.headerTitle}>
              Post
            </ThemedText>

            <View style={styles.placeholder} />
          </View>

          {/* Content */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Post - Flat Design */}
            <View style={styles.postSection}>
              {/* User info */}
              <View style={styles.userSection}>
                <UserAvatar
                  imageUri={post.user.avatarUrl}
                  name={post.user.name}
                  size={44}
                />
                <View style={styles.userInfo}>
                  <View style={styles.userRow}>
                    <ThemedText style={styles.userName}>{post.user.name}</ThemedText>
                    <ThemedText style={[styles.timestamp, { color: colors.textMuted }]}>
                      {formatTimeAgo(post.createdAt)}
                    </ThemedText>
                  </View>
                  {post.location && (
                    <ThemedText style={[styles.location, { color: colors.textSecondary }]}>
                      {post.location}
                    </ThemedText>
                  )}
                </View>
              </View>

              {/* Photos */}
              {post.photos.length > 0 && (
                <PhotoGallery photos={post.photos} height={300} />
              )}

              {/* Caption */}
              {post.caption && (
                <View style={styles.captionSection}>
                  <ThemedText style={styles.caption}>{post.caption}</ThemedText>
                </View>
              )}

              {/* Divider */}
              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              {/* Actions */}
              <View style={styles.actionsContainer}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleLike}
                  activeOpacity={0.7}
                >
                  {post.isLiked ? (
                    <HeartIconSolid size={20} color="#EF4444" />
                  ) : (
                    <HeartIconOutline size={20} color={colors.textSecondary} />
                  )}
                  <ThemedText style={[styles.actionText, { color: colors.textSecondary }]}>
                    {post.likeCount} {post.likeCount === 1 ? 'like' : 'likes'}
                  </ThemedText>
                </TouchableOpacity>

                <View style={styles.actionButton}>
                  <ChatBubbleOvalLeftIcon size={20} color={colors.textSecondary} />
                  <ThemedText style={[styles.actionText, { color: colors.textSecondary }]}>
                    {post.commentCount} {post.commentCount === 1 ? 'comment' : 'comments'}
                  </ThemedText>
                </View>
              </View>
            </View>

            {/* Comments Section */}
            <View style={styles.commentsSection}>
              <ThemedText style={styles.commentsTitle}>
                Comments ({comments.length})
              </ThemedText>

              {comments.length === 0 ? (
                <View style={styles.emptyComments}>
                  <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
                    No comments yet
                  </ThemedText>
                  <ThemedText style={[styles.emptySubtext, { color: colors.textMuted }]}>
                    Be the first to comment!
                  </ThemedText>
                </View>
              ) : (
                comments.map((comment) => (
                  <View key={comment.id} style={styles.commentItem}>
                    <UserAvatar
                      imageUri={comment.user.avatarUrl}
                      name={comment.user.name}
                      size={36}
                    />
                    <View style={styles.commentContent}>
                      <View style={styles.commentHeader}>
                        <ThemedText style={styles.commentAuthor}>
                          {comment.user.name}
                        </ThemedText>
                        <ThemedText style={[styles.commentTime, { color: colors.textMuted }]}>
                          {formatTimeAgo(comment.createdAt)}
                        </ThemedText>
                      </View>
                      <ThemedText style={styles.commentText}>{comment.text}</ThemedText>
                    </View>
                  </View>
                ))
              )}
            </View>
          </ScrollView>

          {/* Comment Input */}
          <View style={[styles.commentInputContainer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
            <TextInput
              style={[
                styles.commentInput,
                { backgroundColor: colors.card, color: colors.text, borderColor: colors.border },
              ]}
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Add a comment..."
              placeholderTextColor={colors.textSecondary}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                {
                  backgroundColor: commentText.trim() ? colors.primary : colors.border,
                },
              ]}
              onPress={handlePostComment}
              disabled={!commentText.trim()}
              activeOpacity={0.7}
            >
              <PaperAirplaneIcon size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </ThemedView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
  },
  postSection: {
    paddingBottom: Spacing.md,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: 12,
  },
  userInfo: {
    flex: 1,
    gap: 2,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  timestamp: {
    fontSize: 12,
    fontWeight: '500',
  },
  location: {
    fontSize: 13,
  },
  captionSection: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  caption: {
    fontSize: 14,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    marginHorizontal: Spacing.lg,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  commentsSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 8,
    borderTopColor: '#F5F5F5',
  },
  commentsTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  emptyComments: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.xs,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
    gap: 12,
  },
  commentContent: {
    flex: 1,
    gap: 4,
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
    gap: Spacing.sm,
  },
  commentInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 15,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
