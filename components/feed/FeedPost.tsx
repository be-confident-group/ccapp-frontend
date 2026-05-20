import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedText } from '@/components/themed-text';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import { formatRelativeTime } from '@/lib/i18n/formatters';
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

type ActivityMeta = { colorKey: 'info' | 'success' | 'warning'; labelKey: string };
const ACTIVITY_META: Record<string, ActivityMeta> = {
  ride: { colorKey: 'info',    labelKey: 'activity.ride' },
  walk: { colorKey: 'success', labelKey: 'activity.walk' },
  run:  { colorKey: 'warning', labelKey: 'activity.run'  },
};

interface FeedPostProps {
  post: ActivityPost;
  onLike: (postId: string) => void;
  onComment: (postId: string) => void;
  onUserPress?: (userId: string) => void;
  onPhotoPress?: (photos: string[], index: number) => void;
}


export const FeedPost = React.memo(function FeedPost({
  post,
  onLike,
  onComment,
  onUserPress,
  onPhotoPress,
}: FeedPostProps) {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation('groups');
  const isTripPost = post.distance != null || post.duration != null;
  const meta = ACTIVITY_META[post.activityType] ?? ACTIVITY_META.walk;
  const metaColor = colors[meta.colorKey];
  const metaLabel = t(meta.labelKey);

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
                  {formatRelativeTime(post.createdAt)}
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
            <View style={[styles.activityBanner, { backgroundColor: metaColor + '12', borderLeftColor: metaColor }]}>
              <View style={styles.activityStats}>
                {post.distance != null && (
                  <View style={styles.activityStat}>
                    <ThemedText style={[styles.activityValue, { color: colors.text }]}>
                      {post.distance >= 1
                        ? `${post.distance.toFixed(1)} km`
                        : `${Math.round(post.distance * 1000)} m`}
                    </ThemedText>
                    <ThemedText style={[styles.activityStatLabel, { color: colors.textMuted }]}>
                      {t('activity.distance')}
                    </ThemedText>
                  </View>
                )}
                {post.duration != null && (
                  <View style={styles.activityStat}>
                    <ThemedText style={[styles.activityValue, { color: colors.text }]}>{fmtDuration(post.duration)}</ThemedText>
                    <ThemedText style={[styles.activityStatLabel, { color: colors.textMuted }]}>
                      {t('activity.duration')}
                    </ThemedText>
                  </View>
                )}
                <View style={[styles.activityTypePill, { backgroundColor: metaColor + '20' }]}>
                  <ThemedText style={[styles.activityTypeText, { color: metaColor }]}>{metaLabel}</ThemedText>
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
    borderRadius: BorderRadius.xl,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  cardInner: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  cardTopHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
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
    fontSize: FontSizes.md,
    fontWeight: '600',
    flex: 1,
  },
  timestamp: {
    fontSize: FontSizes.xs,
    fontWeight: '500',
  },
  location: {
    fontSize: FontSizes.xs,
  },
  activityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    padding: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
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
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
  activityStatLabel: {
    fontSize: FontSizes.xs,
    marginTop: 1,
  },
  activityTypePill: {
    marginLeft: 'auto' as any,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  activityTypeText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  titleSection: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    lineHeight: 22,
  },
  captionSection: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  caption: {
    fontSize: FontSizes.sm,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    marginHorizontal: Spacing.md,
  },
});
