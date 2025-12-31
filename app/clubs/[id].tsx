import React, { useCallback, useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import Header from '@/components/layout/Header';
import { useTheme } from '@/contexts/ThemeContext';
import { Spacing } from '@/constants/theme';
import { useClub, useJoinClub, useLeaveClub } from '@/lib/hooks/useClubs';
import { useClubPosts } from '@/lib/hooks/usePosts';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { FeedPost } from '@/components/feed';
import {
  UsersIcon,
  PlusIcon,
  ArrowLeftStartOnRectangleIcon,
  PencilSquareIcon,
} from 'react-native-heroicons/outline';
import type { Post } from '@/types/feed';
import type { ActivityPost } from '@/types/feed';

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
    likeCount: 0,
    commentCount: post.comment_count,
    isLiked: false,
    createdAt: post.created_at,
    groupId: post.club_id.toString(),
  };
}

export default function ClubDetailScreen() {
  const { t } = useTranslation('groups');
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ id: string }>();
  const clubId = params.id ? parseInt(params.id, 10) : 0;

  const { data: club, isLoading, refetch, isRefetching } = useClub(clubId);
  const { data: posts, isLoading: isLoadingPosts, refetch: refetchPosts } = useClubPosts(clubId);
  const { data: currentUser } = useCurrentUser();
  const joinClubMutation = useJoinClub();
  const leaveClubMutation = useLeaveClub();

  // Transform posts to legacy format and sort by newest first
  const activityPosts = useMemo(() => {
    if (!posts) return [];
    return [...posts]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map(transformPostToActivityPost);
  }, [posts]);

  // Check if current user is the club owner
  const isOwner = useMemo(() => {
    if (!club || !currentUser) return false;
    // Compare by name since SimpleProfile doesn't have email/id
    return club.owner.name === currentUser.name && club.owner.last_name === currentUser.last_name;
  }, [club, currentUser]);
  const isMember = true; // For now, assume user is member if they can view the club

  const handleJoinLeave = useCallback(async () => {
    if (!club) return;

    try {
      if (isMember) {
        await leaveClubMutation.mutateAsync(club.id);
      } else {
        await joinClubMutation.mutateAsync(club.id);
      }
    } catch (error) {
      console.error('Failed to join/leave club:', error);
      alert(error instanceof Error ? error.message : 'Failed to update membership');
    }
  }, [club, isMember, joinClubMutation, leaveClubMutation]);

  const handleCreatePost = useCallback(() => {
    if (!club) return;
    router.push(`/posts/create?clubId=${club.id}`);
  }, [club]);

  const handleEditClub = useCallback(() => {
    if (!club) return;
    router.push(`/clubs/edit?id=${club.id}`);
  }, [club]);

  const handleLike = useCallback((postId: string) => {
    console.log('Like post:', postId);
  }, []);

  const handleComment = useCallback((postId: string) => {
    router.push(`/feed/post-detail?id=${postId}`);
  }, []);

  const handleUserPress = useCallback((userId: string) => {
    console.log('View user profile:', userId);
  }, []);

  const handlePhotoPress = useCallback((photos: string[], index: number) => {
    console.log('View photo:', index, 'of', photos.length);
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

  const renderHeader = () => {
    if (!club) return null;

    return (
      <View style={styles.header}>
        {/* Club Photo */}
        {club.photo ? (
          <Image source={{ uri: club.photo }} style={styles.clubPhoto} />
        ) : (
          <View style={[styles.clubPhotoPlaceholder, { backgroundColor: colors.border }]}>
            <UsersIcon size={48} color={colors.textMuted} />
          </View>
        )}

        {/* Club Info */}
        <View style={styles.clubInfo}>
          <ThemedText style={styles.clubName}>{club.name}</ThemedText>
          {club.description && (
            <ThemedText style={[styles.clubDescription, { color: colors.textSecondary }]}>
              {club.description}
            </ThemedText>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          {!isOwner && (
            <TouchableOpacity
              style={[
                styles.actionButton,
                isMember
                  ? { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }
                  : { backgroundColor: colors.primary },
              ]}
              onPress={handleJoinLeave}
              disabled={joinClubMutation.isPending || leaveClubMutation.isPending}
              activeOpacity={0.8}
            >
              {isMember && <ArrowLeftStartOnRectangleIcon size={18} color={colors.text} />}
              <ThemedText
                style={[
                  styles.actionButtonText,
                  isMember ? { color: colors.text } : { color: '#fff' },
                ]}
              >
                {isMember ? t('clubs.leave', 'Leave') : t('clubs.join', 'Join')}
              </ThemedText>
            </TouchableOpacity>
          )}

          {isMember && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              onPress={handleCreatePost}
              activeOpacity={0.8}
            >
              <PlusIcon size={18} color="#fff" />
              <ThemedText style={[styles.actionButtonText, { color: '#fff' }]}>
                {t('clubs.createPost', 'Post')}
              </ThemedText>
            </TouchableOpacity>
          )}
        </View>

        {/* Members Preview */}
        {club.members && club.members.length > 0 && (
          <View style={styles.membersSection}>
            <View style={styles.membersSectionHeader}>
              <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                {t('clubs.members', 'Members')}
              </ThemedText>
              <ThemedText style={[styles.memberCount, { color: colors.textMuted }]}>
                {club.members.length} {club.members.length === 1 ? 'member' : 'members'}
              </ThemedText>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.membersList}
            >
              {club.members.slice(0, 10).map((member, index) => (
                <View key={index} style={styles.memberItem}>
                  {member.profile_picture ? (
                    <Image source={{ uri: member.profile_picture }} style={styles.memberAvatar} />
                  ) : (
                    <View style={[styles.memberAvatarPlaceholder, { backgroundColor: colors.border }]}>
                      <ThemedText style={styles.memberInitial}>
                        {member.name.charAt(0).toUpperCase()}
                      </ThemedText>
                    </View>
                  )}
                  <ThemedText
                    style={[styles.memberName, { color: colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {member.name}
                  </ThemedText>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Posts Header */}
        <View style={styles.postsHeader}>
          <ThemedText style={styles.sectionTitle}>
            {t('clubs.posts', 'Posts')}
          </ThemedText>
        </View>
      </View>
    );
  };

  const renderEmptyPosts = () => (
    <View style={styles.emptyPosts}>
      <ThemedText style={[styles.emptyMessage, { color: colors.textMuted }]}>
        {t('clubs.noPosts', 'No posts yet. Be the first to post!')}
      </ThemedText>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: colors.background }]}
        edges={['top', 'bottom']}
      >
        <Header title={t('clubs.loading', 'Loading...')} showBack />
        <ThemedView style={styles.container}>
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        </ThemedView>
      </SafeAreaView>
    );
  }

  if (!club) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: colors.background }]}
        edges={['top', 'bottom']}
      >
        <Header title={t('clubs.notFound', 'Club Not Found')} showBack />
        <ThemedView style={styles.container}>
          <View style={styles.loading}>
            <ThemedText>{t('clubs.notFoundMessage', 'This club does not exist.')}</ThemedText>
          </View>
        </ThemedView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['top', 'bottom']}
    >
      <Header
        title={club.name}
        showBack
        rightElement={
          isOwner ? (
            <TouchableOpacity onPress={handleEditClub} style={styles.headerButton}>
              <PencilSquareIcon size={22} color={colors.primary} />
            </TouchableOpacity>
          ) : undefined
        }
      />
      <ThemedView style={styles.container}>
        <FlatList
          data={activityPosts}
          renderItem={renderPost}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmptyPosts}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => {
                refetch();
                refetchPosts();
              }}
              tintColor={colors.primary}
            />
          }
        />
      </ThemedView>
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
  headerButton: {
    padding: Spacing.sm,
    marginRight: Spacing.sm,
  },
  listContent: {
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  header: {
    paddingTop: Spacing.md,
    gap: Spacing.lg,
  },
  clubPhoto: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  clubPhotoPlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubInfo: {
    gap: Spacing.sm,
  },
  clubName: {
    fontSize: 24,
    fontWeight: '700',
  },
  clubDescription: {
    fontSize: 16,
    lineHeight: 24,
  },
  clubMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  memberCount: {
    fontSize: 13,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md + 2,
    borderRadius: 10,
    gap: Spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  membersSection: {
    gap: Spacing.sm,
  },
  membersSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  membersList: {
    gap: Spacing.md,
  },
  memberItem: {
    alignItems: 'center',
    gap: Spacing.xs,
    width: 60,
  },
  memberAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  memberAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInitial: {
    fontSize: 18,
    fontWeight: '600',
  },
  memberName: {
    fontSize: 12,
    textAlign: 'center',
  },
  postsHeader: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  emptyPosts: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  emptyMessage: {
    fontSize: 14,
    textAlign: 'center',
  },
});
