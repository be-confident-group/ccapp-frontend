import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { HeartIcon as HeartIconSolid, ChatBubbleOvalLeftIcon } from 'react-native-heroicons/solid';
import { HeartIcon as HeartIconOutline } from 'react-native-heroicons/outline';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

interface PostActionsProps {
  likeCount: number;
  commentCount: number;
  isLiked: boolean;
  onLike: () => void;
  onComment: () => void;
}

export const PostActions = React.memo(function PostActions({
  likeCount,
  commentCount,
  isLiked,
  onLike,
  onComment,
}: PostActionsProps) {
  const { colors } = useTheme();

  const formatCount = (count: number, singular: string, plural: string): string => {
    return `${count} ${count === 1 ? singular : plural}`;
  };

  return (
    <View style={styles.container}>
      {/* Likes - LEFT side */}
      <TouchableOpacity
        style={styles.actionButton}
        onPress={onLike}
        activeOpacity={0.7}
      >
        {isLiked ? (
          <HeartIconSolid size={20} color="#EF4444" />
        ) : (
          <HeartIconOutline size={20} color={colors.textSecondary} />
        )}
        <ThemedText style={[styles.actionText, { color: colors.textSecondary }]}>
          {formatCount(likeCount, 'like', 'likes')}
        </ThemedText>
      </TouchableOpacity>

      {/* Comments - RIGHT side */}
      <TouchableOpacity
        style={styles.actionButton}
        onPress={onComment}
        activeOpacity={0.7}
      >
        <ChatBubbleOvalLeftIcon size={20} color={colors.textSecondary} />
        <ThemedText style={[styles.actionText, { color: colors.textSecondary }]}>
          {formatCount(commentCount, 'comment', 'comments')}
        </ThemedText>
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
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
});
