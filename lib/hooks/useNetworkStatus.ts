/**
 * Hook for monitoring network connectivity status
 */

import { useState, useEffect, useCallback } from 'react';
import NetInfo, { NetInfoState, NetInfoStateType } from '@react-native-community/netinfo';

export interface NetworkStatus {
  isOnline: boolean;
  isOffline: boolean;
  networkType: NetInfoStateType;
  isInternetReachable: boolean | null;
  isConnected: boolean | null;
}

/**
 * Hook to monitor network connectivity and status
 *
 * @example
 * const { isOnline, isOffline, networkType } = useNetworkStatus();
 *
 * useEffect(() => {
 *   if (isOnline) {
 *     syncService.syncTrips();
 *   }
 * }, [isOnline]);
 */
export function useNetworkStatus() {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isOnline: true, // Optimistic default
    isOffline: false,
    networkType: NetInfoStateType.unknown,
    isInternetReachable: null,
    isConnected: null,
  });

  const [isInitialized, setIsInitialized] = useState(false);

  const updateNetworkStatus = useCallback((state: NetInfoState) => {
    const isConnected = state.isConnected === true;
    const isInternetReachable = state.isInternetReachable !== false; // null means unknown, treat as potentially reachable
    const isOnline = isConnected && isInternetReachable;

    setNetworkStatus({
      isOnline,
      isOffline: !isOnline,
      networkType: state.type,
      isInternetReachable: state.isInternetReachable,
      isConnected: state.isConnected,
    });

    if (!isInitialized) {
      setIsInitialized(true);
    }
  }, [isInitialized]);

  useEffect(() => {
    // Get initial network state
    NetInfo.fetch().then(updateNetworkStatus);

    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener(updateNetworkStatus);

    return () => {
      unsubscribe();
    };
  }, [updateNetworkStatus]);

  return {
    ...networkStatus,
    isInitialized,
  };
}

/**
 * Hook that triggers a callback when network connectivity changes
 *
 * @example
 * useNetworkListener((isOnline) => {
 *   if (isOnline) {
 *     console.log('Back online, syncing...');
 *     syncService.syncTrips();
 *   } else {
 *     console.log('Went offline');
 *   }
 * });
 */
export function useNetworkListener(onNetworkChange: (isOnline: boolean) => void) {
  const [prevOnlineStatus, setPrevOnlineStatus] = useState<boolean | null>(null);
  const { isOnline, isInitialized } = useNetworkStatus();

  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    // Only trigger callback when status actually changes
    if (prevOnlineStatus !== null && prevOnlineStatus !== isOnline) {
      onNetworkChange(isOnline);
    }

    setPrevOnlineStatus(isOnline);
  }, [isOnline, isInitialized, prevOnlineStatus, onNetworkChange]);
}

/**
 * Hook that automatically syncs when network comes back online
 *
 * @param syncFn - Function to call when network comes back online
 * @param enabled - Whether auto-sync is enabled (default: true)
 *
 * @example
 * useAutoSync(async () => {
 *   await syncService.syncTrips();
 * });
 */
export function useAutoSync(syncFn: () => Promise<void>, enabled: boolean = true) {
  useNetworkListener((isOnline) => {
    if (isOnline && enabled) {
      console.log('[useAutoSync] Network online, triggering sync');
      syncFn().catch(error => {
        console.error('[useAutoSync] Sync failed:', error);
      });
    }
  });
}
