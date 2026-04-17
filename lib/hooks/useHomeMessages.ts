/**
 * React Query hook for AI-generated home screen messages.
 * staleTime: 12 h so the client refreshes at most twice a day.
 * 429 (rate-limit) or any other error causes the query to resolve
 * with the previous cached value rather than surfacing an error to the UI.
 */

import { useQuery } from '@tanstack/react-query';
import { getHomeMessages, type HomeMessages } from '@/lib/api/homeMessages';

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

export function useHomeMessages() {
  return useQuery<HomeMessages, Error>({
    queryKey: ['home-messages'],
    queryFn: getHomeMessages,
    staleTime: TWELVE_HOURS_MS,
    gcTime: TWELVE_HOURS_MS * 2,
    retry: (failureCount, error) => {
      // Never retry 429 — the server is already caching so a 429 means the
      // per-user daily limit was hit. Back off silently.
      if (error?.message?.includes('429')) return false;
      return failureCount < 2;
    },
  });
}
