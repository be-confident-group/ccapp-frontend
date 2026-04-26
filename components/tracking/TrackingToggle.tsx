/**
 * Tracking Toggle Component
 *
 * Functional tracking toggle that actually starts/stops background tracking
 */

import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { TrackingCoordinator } from '@/lib/services/TrackingCoordinator';
import { database } from '@/lib/database';

export function useTrackingToggle() {
  const [isTracking, setIsTracking] = useState(false);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Check initial status
  useEffect(() => {
    checkStatus();
  }, []);

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
          Alert.alert(
            'Permissions Required',
            'Background location tracking requires "Always" location permission. Would you like to grant it?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Grant Permission',
                onPress: async () => {
                  const perms = await TrackingCoordinator.requestPermissions();
                  if (perms.location === 'granted') {
                    setHasPermissions(true);
                    await startTracking();
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
