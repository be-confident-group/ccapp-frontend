/**
 * React Query hook for current user profile
 */

import { useQuery } from '@tanstack/react-query';
import { authApi, User } from '@/lib/api/auth';

/**
 * Query key for current user
 */
export const currentUserKeys = {
  all: ['currentUser'] as const,
  profile: () => [...currentUserKeys.all, 'profile'] as const,
};

/**
 * Hook to fetch current user profile
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: currentUserKeys.profile(),
    queryFn: () => authApi.getProfile(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
