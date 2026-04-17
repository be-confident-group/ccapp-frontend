/**
 * Tracking Context
 *
 * Global context for managing background tracking state across the app
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import { LocationTrackingService } from '@/lib/services';
import {
  initializeAppStateListener,
  cleanupAppStateListener,
  setOnPermissionDowngraded,
  setTrackingPreference,
  getTrackingPreference,
} from '@/lib/services/LocationTrackingService';
import { database } from '@/lib/database';
import * as Location from 'expo-location';
import { streamingSegmenter, type LiveActivityState } from '@/lib/activity';

interface TrackingContextType {
  isTracking: boolean;
  hasPermissions: boolean;
  isLoading: boolean;
  liveActivity: LiveActivityState | null;
  toggleTracking: () => Promise<void>;
  checkStatus: () => Promise<void>;
}

const TrackingContext = createContext<TrackingContextType | undefined>(undefined);

export function TrackingProvider({ children }: { children: ReactNode }) {
  const [isTracking, setIsTracking] = useState(false);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [liveActivity, setLiveActivity] = useState<LiveActivityState | null>(null);

  // Initialize AppState listener and check initial status
  useEffect(() => {
    // Initialize AppState listener for foreground/background transitions
    initializeAppStateListener();

    // Set up permission downgrade callback
    setOnPermissionDowngraded(() => {
      console.warn('[TrackingContext] Background permission was downgraded');
      setHasPermissions(false);
      Alert.alert(
        'Permission Changed',
        'Background location permission has been changed. Tracking may not work when the app is in the background. Please enable "Always" location access in Settings for continuous tracking.',
        [
          { text: 'OK', style: 'default' },
        ]
      );
      // Re-check status
      checkStatus();
    });

    // Subscribe to live ML activity updates
    streamingSegmenter.setListener(setLiveActivity);

    // Check initial status
    checkStatus();

    // Cleanup on unmount
    return () => {
      cleanupAppStateListener();
      setOnPermissionDowngraded(null);
      streamingSegmenter.setListener(null);
    };
  }, []);

  async function checkStatus() {
    try {
      const tracking = await LocationTrackingService.isTracking();
      setIsTracking(tracking);

      const perms = await LocationTrackingService.checkPermissions();
      const hasPerms =
        perms.foreground === Location.PermissionStatus.GRANTED &&
        perms.background === Location.PermissionStatus.GRANTED;
      setHasPermissions(hasPerms);

      // Request notification permission if tracking is active and we haven't asked yet.
      // This handles users who upgrade to a version with notifications while already tracking.
      if (tracking || hasPerms) {
        try {
          const { status } = await Notifications.getPermissionsAsync();
          if (status === 'undetermined') {
            await Notifications.requestPermissionsAsync();
          }
        } catch {
          // Notification permission is not critical
        }
      }

      // Auto-resume: if user previously enabled tracking but it's not running
      if (!tracking && hasPerms) {
        const wantsTracking = await getTrackingPreference();
        if (wantsTracking) {
          console.log('[TrackingContext] Auto-resuming tracking after app restart');
          try {
            await startTracking();
          } catch (err) {
            console.error('[TrackingContext] Failed to auto-resume tracking:', err);
          }
        }
      }
    } catch (error) {
      console.error('[TrackingContext] Error checking status:', error);
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
        await setTrackingPreference(false);
        console.log('[TrackingContext] Tracking stopped');
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
      console.error('[TrackingContext] Error toggling tracking:', error);
      const message = error instanceof Error ? error.message : 'Failed to toggle tracking. Please try again.';
      Alert.alert('Tracking Error', message);
    } finally {
      setIsLoading(false);
    }
  }

  async function startTracking() {
    try {
      // Initialize database
      await database.init();

      // Request notification permission (non-blocking — tracking works even if denied)
      try {
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') {
          await Notifications.requestPermissionsAsync();
        }
      } catch {
        // Notification permission is not critical
      }

      // Start tracking
      await LocationTrackingService.startTracking({
        showNotification: true,
      });

      setIsTracking(true);
      await setTrackingPreference(true);
      console.log('[TrackingContext] Tracking started');
    } catch (error) {
      console.error('[TrackingContext] Error starting tracking:', error);
      throw error;
    }
  }

  return (
    <TrackingContext.Provider
      value={{
        isTracking,
        hasPermissions,
        isLoading,
        liveActivity,
        toggleTracking,
        checkStatus,
      }}
    >
      {children}
    </TrackingContext.Provider>
  );
}

export function useTracking() {
  const context = useContext(TrackingContext);
  if (context === undefined) {
    throw new Error('useTracking must be used within a TrackingProvider');
  }
  return context;
}

