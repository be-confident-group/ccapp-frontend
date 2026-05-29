/**
 * Tracking Toggle Component
 *
 * Functional tracking toggle that actually starts/stops background tracking
 */

import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import { TrackingCoordinator } from '@/lib/services/TrackingCoordinator';
import { requestLocationBackground } from '@/lib/permissions/wizard';
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
            ? 'To track your activities automatically, Radzi needs location access all the time.\n\nPlease grant "Allow all the time" permission in the next screen.\n\nThis allows the app to track your walks and rides in the background.'
            : 'To track your activities automatically, Radzi needs "Always Allow" location access.\n\n1. Tap "Open Settings" below\n2. Go to Location\n3. Select "Always"\n\nThis allows the app to track your walks and rides even when you\'re not actively using it.';
          const buttonLabel = Platform.OS === 'android' ? 'Open Settings' : 'Open Settings';
          Alert.alert(
            'Background Tracking Permission',
            message,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: buttonLabel,
                onPress: async () => {
                  const result = await requestLocationBackground();
                  if (result.status === 'granted') {
                    setHasPermissions(true);
                    await startTracking();
                  } else if (result.status === 'opened-settings') {
                    setIsAwaitingPermissionGrant(true);
                  } else {
                    Alert.alert(
                      'Permission Denied',
                      'Background tracking requires "Always" location access. Please enable it in Settings.'
                    );
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
      Alert.alert('Error', 'Failed to toggle tracking. Please try again.');
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
