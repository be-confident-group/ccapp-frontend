/**
 * React Query hook for the local block list (see lib/utils/blockedUsers.ts)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBlockedUserIds, blockUserId } from '@/lib/utils/blockedUsers';

export const blockedUsersKeys = {
  all: ['blockedUserIds'] as const,
};

/**
 * Hook to read the current device's blocked-author id list.
 */
export function useBlockedUsers() {
  return useQuery({
    queryKey: blockedUsersKeys.all,
    queryFn: getBlockedUserIds,
    staleTime: Infinity,
  });
}

/**
 * Hook to block an author. Updates the block-list cache and refreshes
 * feed/post queries so the author's content disappears immediately.
 */
export function useBlockUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: number) => blockUserId(userId),
    onSuccess: (updatedIds) => {
      queryClient.setQueryData(blockedUsersKeys.all, updatedIds);
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });
}
