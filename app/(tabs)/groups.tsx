import React, { useState, useCallback } from 'react';
import { FlatList, StyleSheet, View, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { Spacing } from '@/constants/theme';
import {
  FeedHeader,
  FeedSearchBar,
  FeedPost,
  GroupSelectorModal,
} from '@/components/feed';
import type { ActivityPost, FeedGroup } from '@/types/feed';
import { mockPosts, mockGroups } from '@/lib/utils/mockFeedData';
import { NewspaperIcon } from 'react-native-heroicons/outline';

export default function FeedScreen() {
  const { t } = useTranslation('groups');
  const { colors } = useTheme();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<FeedGroup | null>(null);
  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [posts, setPosts] = useState<ActivityPost[]>(mockPosts);

  const handleLeaderboardPress = useCallback(() => {
    router.push('/feed/leaderboards');
  }, []);

  const handleGroupSelectPress = useCallback(() => {
    setGroupModalVisible(true);
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // TODO: Fetch fresh data from API
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const handleLike = useCallback((postId: string) => {
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? {
              ...post,
              isLiked: !post.isLiked,
              likeCount: post.isLiked ? post.likeCount - 1 : post.likeCount + 1,
            }
          : post
      )
    );
  }, []);

  const handleComment = useCallback((postId: string) => {
    router.push(`/feed/post-detail?id=${postId}`);
  }, []);

  const handleUserPress = useCallback((userId: string) => {
    // TODO: Navigate to user profile
    console.log('View user profile:', userId);
  }, []);

  const handlePhotoPress = useCallback((photos: string[], index: number) => {
    // TODO: Open full-screen photo viewer
    console.log('View photo:', index, 'of', photos.length);
  }, []);

  // Filter posts based on search and selected group
  const filteredPosts = posts.filter((post) => {
    if (selectedGroup && post.groupId !== selectedGroup.id) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        post.user.name.toLowerCase().includes(query) ||
        post.caption.toLowerCase().includes(query) ||
        post.location?.toLowerCase().includes(query)
      );
    }
    return true;
  });

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

  const renderEmptyState = () => (
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

  const renderListHeader = () => (
    <FeedSearchBar
      value={searchQuery}
      onChangeText={setSearchQuery}
      placeholder={t('feed.searchPlaceholder')}
    />
  );

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <ThemedView style={styles.container}>
        <FeedHeader
          onLeaderboardPress={handleLeaderboardPress}
          onGroupSelectPress={handleGroupSelectPress}
          selectedGroup={selectedGroup}
        />

        <FlatList
          data={filteredPosts}
          renderItem={renderPost}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderListHeader}
          contentContainerStyle={[
            styles.listContent,
            filteredPosts.length === 0 && styles.emptyListContent,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={renderEmptyState}
        />

        <GroupSelectorModal
          visible={groupModalVisible}
          onClose={() => setGroupModalVisible(false)}
          groups={mockGroups}
          selectedGroupId={selectedGroup?.id}
          onSelectGroup={(group) => {
            setSelectedGroup(group);
            setGroupModalVisible(false);
          }}
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
    fontSize: 18,
    fontWeight: '600',
  },
  emptyMessage: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
});
