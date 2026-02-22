/**
 * React Query hooks for Post API operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { postAPI } from '@/lib/api/posts';
import type {
  Post,
  PostCreateRequest,
  PostUpdateRequest,
  PostCommentCreateRequest,
} from '@/types/feed';
import type { PostFilters } from '@/lib/api/posts';

/**
 * Query key factory for posts
 */
export const postKeys = {
  all: ['posts'] as const,
  lists: () => [...postKeys.all, 'list'] as const,
  list: (clubId: number, filters?: PostFilters) =>
    [...postKeys.lists(), clubId, filters] as const,
  details: () => [...postKeys.all, 'detail'] as const,
  detail: (clubId: number, postId: number) => [...postKeys.details(), clubId, postId] as const,
};

/**
 * Hook to fetch posts for a club
 */
export function useClubPosts(clubId: number, filters?: PostFilters) {
  return useQuery({
    queryKey: postKeys.list(clubId, filters),
    queryFn: () => postAPI.getClubPosts(clubId, filters),
    enabled: !!clubId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Hook to fetch a specific post
 */
export function usePost(clubId: number, postId: number) {
  return useQuery({
    queryKey: postKeys.detail(clubId, postId),
    queryFn: () => postAPI.getPost(clubId, postId),
    enabled: !!clubId && !!postId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to create a post
 */
export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ clubId, data }: { clubId: number; data: PostCreateRequest }) =>
      postAPI.createPost(clubId, data),
    onSuccess: (newPost, { clubId }) => {
      // Invalidate club posts list
      queryClient.invalidateQueries({ queryKey: postKeys.list(clubId) });

      // Invalidate feed (new post should appear in feed)
      queryClient.invalidateQueries({ queryKey: ['feed'] });

      // Add to cache
      queryClient.setQueryData<Post>(postKeys.detail(clubId, newPost.id), newPost);
    },
  });
}

/**
 * Hook to update a post
 */
export function useUpdatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      clubId,
      postId,
      data,
    }: {
      clubId: number;
      postId: number;
      data: PostUpdateRequest;
    }) => postAPI.updatePost(clubId, postId, data),
    onSuccess: (updatedPost, { clubId, postId }) => {
      // Update cache
      queryClient.setQueryData<Post>(postKeys.detail(clubId, postId), updatedPost);

      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: postKeys.list(clubId) });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}

/**
 * Hook to delete a post
 */
export function useDeletePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ clubId, postId }: { clubId: number; postId: number }) =>
      postAPI.deletePost(clubId, postId),
    onSuccess: (_, { clubId, postId }) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: postKeys.detail(clubId, postId) });

      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: postKeys.list(clubId) });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}

/**
 * Hook to add a comment to a post
 */
export function useAddComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      clubId,
      postId,
      text,
    }: {
      clubId: number;
      postId: number;
      text: string;
    }) => postAPI.addComment(clubId, postId, { text }),
    onSuccess: (_, { clubId, postId }) => {
      // Invalidate post detail to refresh comments
      queryClient.invalidateQueries({ queryKey: postKeys.detail(clubId, postId) });

      // Invalidate lists to update comment count
      queryClient.invalidateQueries({ queryKey: postKeys.list(clubId) });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}

/**
 * Hook to delete a comment
 */
export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      clubId,
      postId,
      commentId,
    }: {
      clubId: number;
      postId: number;
      commentId: number;
    }) => postAPI.deleteComment(clubId, postId, commentId),
    onSuccess: (_, { clubId, postId }) => {
      // Invalidate post detail to refresh comments
      queryClient.invalidateQueries({ queryKey: postKeys.detail(clubId, postId) });

      // Invalidate lists to update comment count
      queryClient.invalidateQueries({ queryKey: postKeys.list(clubId) });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}

/**
 * Hook to toggle like/unlike on a post
 */
export function useTogglePostLike() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      clubId,
      postId,
      isLiked,
    }: {
      clubId: number;
      postId: number;
      isLiked: boolean;
    }) => {
      // Call the appropriate API based on current state
      if (isLiked) {
        await postAPI.unlikePost(clubId, postId);
      } else {
        await postAPI.likePost(clubId, postId);
      }
    },
    onMutate: async ({ clubId, postId, isLiked }) => {
      // Cancel all outgoing refetches for this post
      await queryClient.cancelQueries({ queryKey: postKeys.detail(clubId, postId) });
      await queryClient.cancelQueries({ queryKey: postKeys.list(clubId) });
      await queryClient.cancelQueries({ queryKey: ['feed'] });

      // Helper to update a post's like status
      const updatePost = (post: Post) => ({
        ...post,
        is_liked: !isLiked,
        likes_count: isLiked ? post.likes_count - 1 : post.likes_count + 1,
      });

      // Snapshot previous values for rollback
      const previousDetail = queryClient.getQueryData<Post>(postKeys.detail(clubId, postId));
      const previousLists: Array<{ queryKey: readonly unknown[]; data: Post[] }> = [];
      const previousFeed: Array<{ queryKey: unknown[]; data: any }> = [];

      // Optimistically update post detail
      queryClient.setQueryData<Post>(postKeys.detail(clubId, postId), (old) => {
        if (!old) return old;
        return updatePost(old);
      });

      // Optimistically update all club post lists that contain this post
      queryClient.setQueriesData<Post[]>({ queryKey: postKeys.lists() }, (oldPosts) => {
        if (!oldPosts) return oldPosts;
        const updated = oldPosts.map((post) =>
          post.id === postId ? updatePost(post) : post
        );
        // Store snapshot
        previousLists.push({
          queryKey: postKeys.lists(),
          data: oldPosts,
        });
        return updated;
      });

      // Optimistically update infinite feed queries
      queryClient.setQueriesData<{ pages: Array<{ results: Post[] }> }>(
        { queryKey: ['feed'] },
        (oldData) => {
          if (!oldData?.pages) return oldData;
          const updated = {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              results: page.results.map((post) =>
                post.id === postId ? updatePost(post) : post
              ),
            })),
          };
          // Store snapshot
          previousFeed.push({
            queryKey: ['feed'],
            data: oldData,
          });
          return updated;
        }
      );

      // Return context for rollback
      return { previousDetail, previousLists, previousFeed };
    },
    onError: (err, { clubId, postId }, context) => {
      // Rollback all optimistic updates on error
      if (context?.previousDetail) {
        queryClient.setQueryData<Post>(postKeys.detail(clubId, postId), context.previousDetail);
      }
      if (context?.previousLists) {
        context.previousLists.forEach(({ queryKey, data }) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousFeed) {
        context.previousFeed.forEach(({ queryKey, data }) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    // No need to invalidate on success - optimistic updates handle everything
  });
}
