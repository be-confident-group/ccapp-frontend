import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { ActivityPost } from '@/types/feed';
import { UserAvatar } from './UserAvatar';
import { PhotoGallery } from './PhotoGallery';
import { PostActions } from './PostActions';

function fmtDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const ACTIVITY_META: Record<string, { icon: string; color: string; label: string }> = {
  ride:  { icon: 'bike',  color: '#2196F3', label: 'Ride'  },
  walk:  { icon: 'walk',  color: '#4CAF50', label: 'Walk'  },
  run:   { icon: 'run',   color: '#FF9800', label: 'Run'   },
};

interface FeedPostProps {
  post: ActivityPost;
  onLike: (postId: string) => void;
  onComment: (postId: string) => void;
  onUserPress?: (userId: string) => void;
  onPhotoPress?: (photos: string[], index: number) => void;
}

const formatTimeAgo = (timestamp: string): string => {
  const now = new Date();
  const postDate = new Date(timestamp);
  const diffMs = now.getTime() - postDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  // Show date for older posts
  return postDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const FeedPost = React.memo(function FeedPost({
  post,
  onLike,
  onComment,
  onUserPress,
  onPhotoPress,
}: FeedPostProps) {
  const { colors, isDark } = useTheme();
  const isTripPost = post.distance != null || post.duration != null;
  const meta = ACTIVITY_META[post.activityType] ?? ACTIVITY_META.walk;

  return (
    <View style={styles.cardContainer}>
      <View style={[styles.cardShadow, { shadowColor: isDark ? '#000' : '#000' }]}>
        <View style={[styles.cardInner, { backgroundColor: colors.card }]}>
          {/* 3D highlight - light mode only */}
          {!isDark && (
            <LinearGradient
              pointerEvents="none"
              colors={['rgba(255,255,255,0.6)', 'rgba(255,255,255,0)']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 0.3 }}
              style={styles.cardTopHighlight}
            />
          )}

          {/* User info section */}
          <TouchableOpacity
            style={styles.userSection}
            onPress={() => onUserPress?.(post.user.id)}
            activeOpacity={0.7}
          >
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
          </TouchableOpacity>

          {/* Activity stats banner — shown for trip posts */}
          {isTripPost && (
            <View style={[styles.activityBanner, { backgroundColor: meta.color + '12', borderLeftColor: meta.color }]}>
              <MaterialCommunityIcons name={meta.icon as any} size={20} color={meta.color} />
              <View style={styles.activityStats}>
                {post.distance != null && (
                  <View style={styles.activityStat}>
                    <ThemedText style={[styles.activityValue, { color: colors.text }]}>
                      {post.distance >= 1
                        ? `${post.distance.toFixed(1)} km`
                        : `${Math.round(post.distance * 1000)} m`}
                    </ThemedText>
                    <ThemedText style={[styles.activityStatLabel, { color: colors.textMuted }]}>Distance</ThemedText>
                  </View>
                )}
                {post.duration != null && (
                  <View style={styles.activityStat}>
                    <ThemedText style={[styles.activityValue, { color: colors.text }]}>{fmtDuration(post.duration)}</ThemedText>
                    <ThemedText style={[styles.activityStatLabel, { color: colors.textMuted }]}>Duration</ThemedText>
                  </View>
                )}
                <View style={[styles.activityTypePill, { backgroundColor: meta.color + '20' }]}>
                  <ThemedText style={[styles.activityTypeText, { color: meta.color }]}>{meta.label}</ThemedText>
                </View>
              </View>
            </View>
          )}

          {/* Photo gallery */}
          {post.photos.length > 0 && (
            <PhotoGallery
              photos={post.photos}
              onPhotoPress={(index) => onPhotoPress?.(post.photos, index)}
            />
          )}

          {/* Title — hidden for trip posts (backend auto-generates generic titles) */}
          {post.title && !isTripPost && (
            <View style={styles.titleSection}>
              <ThemedText style={styles.title}>{post.title}</ThemedText>
            </View>
          )}

          {/* Caption */}
          {post.caption && (
            <View style={styles.captionSection}>
              <ThemedText style={styles.caption}>{post.caption}</ThemedText>
            </View>
          )}

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Actions: likes left, comments right */}
          <PostActions
            likeCount={post.likeCount}
            commentCount={post.commentCount}
            isLiked={post.isLiked}
            onLike={() => onLike(post.id)}
            onComment={() => onComment(post.id)}
          />
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  cardContainer: {
    marginBottom: Spacing.lg,
  },
  cardShadow: {
    borderRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  cardInner: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  cardTopHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    zIndex: 1,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
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
  activityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    padding: Spacing.sm + 2,
    borderRadius: 10,
    borderLeftWidth: 3,
  },
  activityStats: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  activityStat: {
    alignItems: 'flex-start',
  },
  activityValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  activityStatLabel: {
    fontSize: 11,
    marginTop: 1,
  },
  activityTypePill: {
    marginLeft: 'auto' as any,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  activityTypeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  titleSection: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22,
  },
  captionSection: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  caption: {
    fontSize: 14,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    marginHorizontal: Spacing.md,
  },
});
