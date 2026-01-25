/**
 * React Query hooks for Trip API operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tripAPI } from '@/lib/api/trips';
import type {
  ApiTrip,
  ApiTripCreate,
  TripFilters,
} from '@/lib/api/trips';

/**
 * Query key factory for trips
 */
export const tripKeys = {
  all: ['trips'] as const,
  lists: () => [...tripKeys.all, 'list'] as const,
  list: (filters?: TripFilters) => [...tripKeys.lists(), filters] as const,
  details: () => [...tripKeys.all, 'detail'] as const,
  detail: (id: number) => [...tripKeys.details(), id] as const,
};

/**
 * Hook to fetch all trips from backend
 */
export function useTrips(filters?: TripFilters) {
  return useQuery({
    queryKey: tripKeys.list(filters),
    queryFn: () => tripAPI.getTrips(filters),
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchInterval: 1000 * 30, // Auto-refetch every 30 seconds
    refetchIntervalInBackground: false, // Only refetch when app is active
  });
}

/**
 * Hook to fetch a specific trip
 */
export function useTrip(id: number) {
  return useQuery({
    queryKey: tripKeys.detail(id),
    queryFn: () => tripAPI.getTrip(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to create a trip
 */
export function useCreateTrip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ApiTripCreate) => tripAPI.createTrip(data),
    onSuccess: (newTrip) => {
      // Invalidate trips list
      queryClient.invalidateQueries({ queryKey: tripKeys.lists() });

      // Add to cache
      queryClient.setQueryData<ApiTrip>(tripKeys.detail(newTrip.id), newTrip);

      // Invalidate user profile to update stats
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
    },
  });
}

/**
 * Hook to update a trip
 */
export function useUpdateTrip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ApiTripCreate> }) =>
      tripAPI.updateTrip(id, data),
    onSuccess: (updatedTrip, { id }) => {
      // Update cache
      queryClient.setQueryData<ApiTrip>(tripKeys.detail(id), updatedTrip);

      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: tripKeys.lists() });

      // Invalidate user profile to update stats
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
    },
  });
}

/**
 * Hook to delete a trip
 */
export function useDeleteTrip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => tripAPI.deleteTrip(id),
    onSuccess: (_, id) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: tripKeys.detail(id) });

      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: tripKeys.lists() });

      // Invalidate user profile to update stats
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
    },
  });
}

/**
 * Hook to share a trip to a club
 */
export function useShareTrip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      tripId,
      clubId,
      title,
      text,
    }: {
      tripId: number;
      clubId: number;
      title?: string;
      text?: string;
    }) => tripAPI.shareTrip(tripId, clubId, title, text),
    onSuccess: (_, { tripId }) => {
      // Invalidate trip detail
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) });

      // Invalidate feed to show new post
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}

/**
 * Hook to unshare a trip from a club
 */
export function useUnshareTrip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ tripId, clubId }: { tripId: number; clubId: number }) =>
      tripAPI.unshareTrip(tripId, clubId),
    onSuccess: (_, { tripId }) => {
      // Invalidate trip detail
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) });

      // Invalidate feed
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}
