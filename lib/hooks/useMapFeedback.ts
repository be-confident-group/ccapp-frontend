/**
 * React Query hooks for Map Feedback API operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mapFeedbackApi, type CreateMapFeedbackRequest, type UpdateMapFeedbackRequest } from '@/lib/api/mapFeedback';

/**
 * Query key factory for map feedback
 */
export const mapFeedbackKeys = {
  all: ['mapFeedback'] as const,
  lists: () => [...mapFeedbackKeys.all, 'list'] as const,
  list: () => [...mapFeedbackKeys.lists()] as const,
};

/**
 * Hook to fetch user's map feedback reports
 */
export function useMapFeedback() {
  return useQuery({
    queryKey: mapFeedbackKeys.list(),
    queryFn: () => mapFeedbackApi.getMyFeedback(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to create a map feedback report
 */
export function useCreateMapFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateMapFeedbackRequest) => mapFeedbackApi.createFeedback(data),
    onSuccess: () => {
      // Invalidate and refetch feedback list
      queryClient.invalidateQueries({ queryKey: mapFeedbackKeys.list() });
    },
  });
}

/**
 * Hook to update a map feedback report
 */
export function useUpdateMapFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateMapFeedbackRequest }) =>
      mapFeedbackApi.updateFeedback(id, data),
    onSuccess: () => {
      // Invalidate and refetch feedback list
      queryClient.invalidateQueries({ queryKey: mapFeedbackKeys.list() });
    },
  });
}

/**
 * Hook to delete a map feedback report
 */
export function useDeleteMapFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => mapFeedbackApi.deleteFeedback(id),
    onSuccess: () => {
      // Invalidate and refetch feedback list
      queryClient.invalidateQueries({ queryKey: mapFeedbackKeys.list() });
    },
  });
}
