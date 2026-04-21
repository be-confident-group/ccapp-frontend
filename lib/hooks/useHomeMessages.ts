/**
 * React Query hook for AI-generated home screen messages.
 * staleTime: 12 h so the client refreshes at most twice a day.
 * 429 (rate-limit) or any other error causes the query to resolve
 * with the previous cached value rather than surfacing an error to the UI.
 */

import { useQuery } from '@tanstack/react-query';
import { getHomeMessages, type HomeMessages } from '@/lib/api/homeMessages';

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

function isThrottleError(error: Error | null): boolean {
  if (!error?.message) return false;
  return error.message.includes('429') || error.message.toLowerCase().includes('throttled');
}

export function useHomeMessages() {
  return useQuery<HomeMessages, Error>({
    queryKey: ['home-messages'],
    queryFn: async () => {
      const result = await getHomeMessages();
      if (!result?.stats_message && !result?.streak_message) {
        console.warn('[homeMessages] API returned empty messages:', result);
      }
      return result;
    },
    staleTime: TWELVE_HOURS_MS,
    gcTime: TWELVE_HOURS_MS * 2,
    retry: (failureCount, error) => {
      if (isThrottleError(error)) return false;
      return failureCount < 2;
    },
    throwOnError: false,
  });
}
