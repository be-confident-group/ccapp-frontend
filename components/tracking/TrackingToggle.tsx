/**
 * Tracking Toggle Component
 *
 * Functional tracking toggle that actually starts/stops background tracking
 */

import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { LocationTrackingService } from '@/lib/services';
import { database } from '@/lib/database';
import * as Location from 'expo-location';

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
      const tracking = await LocationTrackingService.isTracking();
      setIsTracking(tracking);

      const perms = await LocationTrackingService.checkPermissions();
      setHasPermissions(
        perms.foreground === Location.PermissionStatus.GRANTED &&
        perms.background === Location.PermissionStatus.GRANTED
      );
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
        await LocationTrackingService.stopTracking();
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
                  const perms = await LocationTrackingService.requestPermissions();
                  if (perms.background === Location.PermissionStatus.GRANTED) {
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
      await LocationTrackingService.startTracking({
        showNotification: true,
      });

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
