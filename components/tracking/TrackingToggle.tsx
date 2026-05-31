/**
 * Tracking Toggle Component
 *
 * Functional tracking toggle that actually starts/stops background tracking
 */

import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import { TrackingCoordinator } from '@/lib/services/TrackingCoordinator';
import { requestLocationBackground } from '@/lib/permissions/wizard';
import i18n from '@/lib/i18n';
import { showAlert } from '@/lib/utils/alert';
import { database } from '@/lib/database';

export function useTrackingToggle() {
  const [isTracking, setIsTracking] = useState(false);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAwaitingPermissionGrant, setIsAwaitingPermissionGrant] = useState(false);
  const prevAppState = useRef(AppState.currentState);

  // Check initial status
  useEffect(() => {
    checkStatus();
  }, []);

  useEffect(() => {
    if (!isAwaitingPermissionGrant) return;

    const sub = AppState.addEventListener('change', async (nextState) => {
      if (prevAppState.current !== 'active' && nextState === 'active') {
        prevAppState.current = nextState;
        setIsAwaitingPermissionGrant(false);
        const perms = await TrackingCoordinator.checkPermissions();
        if (perms.location === 'granted') {
          setHasPermissions(true);
          setIsLoading(true);
          try {
            await startTracking();
          } catch (err) {
            console.error('[TrackingToggle] Failed to start tracking after permission grant:', err);
          } finally {
            setIsLoading(false);
          }
        }
      } else {
        prevAppState.current = nextState;
      }
    });

    return () => sub.remove();
  }, [isAwaitingPermissionGrant]);

  async function checkStatus() {
    try {
      const status = await TrackingCoordinator.getStatus();
      const tracking = 'state' in status ? status.state !== 'idle' : false;
      setIsTracking(tracking);

      const perms = await TrackingCoordinator.checkPermissions();
      setHasPermissions(perms.location === 'granted');
    } catch (error) {
      console.error('[TrackingToggle] Error checking status:', error);
    }
  }

  async function toggleTracking() {
    if (isLoading) return;

    setIsLoading(true);

    try {
      if (isTracking) {
        // Stop tracking
        await TrackingCoordinator.stop();
        setIsTracking(false);
        console.log('[TrackingToggle] Tracking stopped');
      } else {
        // Check permissions first
        if (!hasPermissions) {
          const message = Platform.OS === 'android'
            ? i18n.t('alerts:backgroundPermission.androidMessage')
            : i18n.t('alerts:backgroundPermission.iosMessage');
          Alert.alert(
            i18n.t('alerts:backgroundPermission.title'),
            message,
            [
              { text: i18n.t('alerts:backgroundPermission.cancel'), style: 'cancel' },
              {
                text: i18n.t('alerts:backgroundPermission.openSettings'),
                onPress: async () => {
                  const result = await requestLocationBackground();
                  if (result.status === 'granted') {
                    setHasPermissions(true);
                    await startTracking();
                  } else if (result.status === 'opened-settings') {
                    setIsAwaitingPermissionGrant(true);
                  } else {
                    showAlert('alerts:permission.deniedTitle', 'alerts:permission.deniedMessage');
                  }
                },
              },
            ]
          );
          setIsLoading(false);
          return;
        }

        await startTracking();
      }
    } catch (error) {
      console.error('[TrackingToggle] Error toggling tracking:', error);
      showAlert('alerts:error.title', 'alerts:tracking.toggleError');
    } finally {
      setIsLoading(false);
    }
  }

  async function startTracking() {
    try {
      // Initialize database
      await database.init();

      // Start tracking
      await TrackingCoordinator.start();

      setIsTracking(true);
      console.log('[TrackingToggle] Tracking started');
    } catch (error) {
      console.error('[TrackingToggle] Error starting tracking:', error);
      throw error;
    }
  }

  return {
    isTracking,
    hasPermissions,
    isLoading,
    toggleTracking,
    checkStatus,
  };
}
