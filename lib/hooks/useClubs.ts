/**
 * React Query hooks for Club API operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clubAPI } from '@/lib/api/clubs';
import type { Club, ClubCreateRequest, ClubUpdateRequest, JoinRequest } from '@/types/feed';

/**
 * Query key factory for clubs
 */
export const clubKeys = {
  all: ['clubs'] as const,
  lists: () => [...clubKeys.all, 'list'] as const,
  list: (search?: string) => [...clubKeys.lists(), { search }] as const,
  myClubs: () => [...clubKeys.all, 'my'] as const,
  details: () => [...clubKeys.all, 'detail'] as const,
  detail: (id: number) => [...clubKeys.details(), id] as const,
  shareCode: (code: string) => [...clubKeys.all, 'share', code] as const,
  joinRequests: (clubId: number) => [...clubKeys.all, 'join-requests', clubId] as const,
};

/**
 * Hook to fetch all clubs (with optional search)
 */
export function useClubs(search?: string) {
  return useQuery({
    queryKey: clubKeys.list(search),
    queryFn: () => clubAPI.getClubs(search),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to fetch user's clubs
 */
export function useMyClubs() {
  return useQuery({
    queryKey: clubKeys.myClubs(),
    queryFn: () => clubAPI.getMyClubs(),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Hook to fetch a club by its share code
 */
export function useClubByShareCode(shareCode: string) {
  return useQuery({
    queryKey: clubKeys.shareCode(shareCode),
    queryFn: () => clubAPI.getClubByShareCode(shareCode),
    enabled: !!shareCode,
    retry: false,
    gcTime: 0,
  });
}

/**
 * Hook to fetch a specific club
 */
export function useClub(id: number) {
  return useQuery({
    queryKey: clubKeys.detail(id),
    queryFn: () => clubAPI.getClub(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to create a club
 */
export function useCreateClub() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ClubCreateRequest) => clubAPI.createClub(data),
    onSuccess: (newClub) => {
      // Invalidate and refetch club lists
      queryClient.invalidateQueries({ queryKey: clubKeys.lists() });
      queryClient.invalidateQueries({ queryKey: clubKeys.myClubs() });

      // Invalidate detail so the detail page fetches fresh complete data
      // (the create response may not include owner/members)
      if (newClub.id) {
        queryClient.invalidateQueries({ queryKey: clubKeys.detail(newClub.id) });
      }
    },
  });
}

/**
 * Hook to update a club
 */
export function useUpdateClub() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ClubUpdateRequest }) =>
      clubAPI.updateClub(id, data),
    onSuccess: (updatedClub) => {
      // Update the club detail cache
      queryClient.setQueryData<Club>(clubKeys.detail(updatedClub.id), updatedClub);

      // Invalidate lists to reflect the update
      queryClient.invalidateQueries({ queryKey: clubKeys.lists() });
      queryClient.invalidateQueries({ queryKey: clubKeys.myClubs() });
    },
  });
}

/**
 * Hook to delete a club
 */
export function useDeleteClub() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => clubAPI.deleteClub(id),
    onSuccess: (_, id) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: clubKeys.detail(id) });

      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: clubKeys.lists() });
      queryClient.invalidateQueries({ queryKey: clubKeys.myClubs() });
    },
  });
}

/**
 * Hook to join a club
 */
export function useJoinClub() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => clubAPI.joinClub(id),
    onSuccess: (_, id) => {
      // Invalidate my clubs list (user is now a member)
      queryClient.invalidateQueries({ queryKey: clubKeys.myClubs() });

      // Invalidate the club detail (member count changed)
      queryClient.invalidateQueries({ queryKey: clubKeys.detail(id) });
    },
  });
}

/**
 * Hook to leave a club
 */
export function useLeaveClub() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => clubAPI.leaveClub(id),
    onSuccess: (_, id) => {
      // Invalidate my clubs list (user is no longer a member)
      queryClient.invalidateQueries({ queryKey: clubKeys.myClubs() });

      // Invalidate the club detail (member count changed)
      queryClient.invalidateQueries({ queryKey: clubKeys.detail(id) });
    },
  });
}

/**
 * Hook to request to join a private club
 */
export function useRequestJoinClub() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => clubAPI.requestJoin(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: clubKeys.detail(id) });
    },
  });
}

/**
 * Hook to list pending join requests for a club (owner only)
 */
export function useJoinRequests(clubId: number, enabled = true) {
  return useQuery<JoinRequest[]>({
    queryKey: clubKeys.joinRequests(clubId),
    queryFn: () => clubAPI.listJoinRequests(clubId),
    enabled: enabled && !!clubId,
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Hook to accept a join request (owner only)
 */
export function useAcceptJoinRequest(clubId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (requestId: number) => clubAPI.acceptJoinRequest(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clubKeys.joinRequests(clubId) });
      queryClient.invalidateQueries({ queryKey: clubKeys.detail(clubId) });
    },
  });
}

/**
 * Hook to reject a join request (owner only)
 */
export function useRejectJoinRequest(clubId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (requestId: number) => clubAPI.rejectJoinRequest(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clubKeys.joinRequests(clubId) });
    },
  });
}

/**
 * Hook to remove a member from a club (owner only)
 */
export function useRemoveMember(clubId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: number) => clubAPI.removeMember(clubId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clubKeys.detail(clubId) });
    },
  });
}

/**
 * Hook to transfer club ownership (owner only)
 */
export function useTransferOwnership(clubId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (newOwnerId: number) => clubAPI.transferOwnership(clubId, newOwnerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clubKeys.detail(clubId) });
      queryClient.invalidateQueries({ queryKey: clubKeys.myClubs() });
    },
  });
}
