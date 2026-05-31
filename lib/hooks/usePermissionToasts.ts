// lib/hooks/usePermissionToasts.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import {
  checkAll,
  openAppSettings,
  requestLocationForeground,
  requestLocationBackground,
  requestMotion,
  requestNotifications,
  type PermissionResult,
} from '@/lib/permissions/wizard';

export type PermissionToastKey =
  | 'locationForeground'
  | 'locationBackground'
  | 'motion'
  | 'notifications';

export type PermissionToastState = {
  key: PermissionToastKey;
  needsSettings: boolean;
} | null;

const PRIORITY_ORDER: PermissionToastKey[] = [
  'locationForeground',
  'locationBackground',
  'motion',
  'notifications',
];

const PERMISSION_SETTLE_DELAY_MS = 600;
const PERMISSION_NEXT_DELAY_MS = 1500;

// Module-level: survives re-mounts and ensures singleton dismissed state
const dismissed = new Set<PermissionToastKey>();

export function usePermissionToasts() {
  const [current, setCurrent] = useState<PermissionToastState>(null);
  const [isRequesting, setIsRequesting] = useState(false);

  // Refs — stable across renders, safe to read inside useCallback with [] deps
  const prevAppState = useRef<AppStateStatus>(AppState.currentState);
  const nextTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const computeNext = useCallback(async () => {
    try {
      const statuses = await checkAll();

      const missing = PRIORITY_ORDER.filter((key) => {
        if (dismissed.has(key)) return false;
        return statuses[key] !== 'granted';
      });

      if (missing.length === 0) {
        setCurrent(null);
        return;
      }

      const key = missing[0];
      const status = statuses[key];
      const needsSettings =
        (key === 'locationBackground' && Platform.OS === 'android') ||
        status === 'denied';

      setCurrent({ key, needsSettings });
    } catch (err) {
      console.warn('[usePermissionToasts] computeNext failed:', err);
      setCurrent(null);
    }
  }, []); // dismissed is a ref — stable

  useEffect(() => {
    computeNext();

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (prevAppState.current !== 'active' && next === 'active') {
        computeNext();
      }
      prevAppState.current = next;
    });

    return () => {
      sub.remove();
      if (nextTimer.current) clearTimeout(nextTimer.current);
    };
  }, [computeNext]);

  const handleAllow = useCallback(async () => {
    if (!current || isRequesting) return;
    setIsRequesting(true);
    let result: PermissionResult = { status: 'denied' };
    try {
      switch (current.key) {
        case 'locationForeground':
          result = await requestLocationForeground();
          break;
        case 'locationBackground':
          result = await requestLocationBackground();
          break;
        case 'motion':
          result = await requestMotion();
          break;
        case 'notifications':
          result = await requestNotifications();
          break;
      }
      if (result.status !== 'opened-settings') {
        // Re-check after OS updates its permission state
        if (nextTimer.current) clearTimeout(nextTimer.current);
        nextTimer.current = setTimeout(computeNext, PERMISSION_SETTLE_DELAY_MS);
      }
      // If opened-settings: AppState listener handles re-check on return
    } finally {
      setIsRequesting(false);
    }
  }, [current, isRequesting, computeNext]);

  const handleOpenSettings = useCallback(() => {
    openAppSettings();
    // AppState listener will re-check when user returns
  }, []);

  const handleDismiss = useCallback(() => {
    if (!current) return;
    dismissed.add(current.key);
    setCurrent(null);
    // Show the next missing permission after a short delay
    if (nextTimer.current) clearTimeout(nextTimer.current);
    nextTimer.current = setTimeout(computeNext, PERMISSION_NEXT_DELAY_MS);
  }, [current, computeNext]);

  return { current, isRequesting, handleAllow, handleOpenSettings, handleDismiss };
}
