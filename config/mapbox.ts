/**
 * Mapbox initialization and configuration
 */

import Mapbox from '@rnmapbox/maps';
import Constants from 'expo-constants';

/**
 * Initialize Mapbox with access token
 * Call this once at app startup
 */
export function initializeMapbox(): void {
  try {
    // Get token from app config extras
    const token =
      Constants.expoConfig?.extra?.mapboxPublicToken ||
      process.env.MAPBOX_ACCESS_TOKEN;

    if (!token) {
      console.error(
        '[Mapbox] Access token not found. Please set MAPBOX_ACCESS_TOKEN in .env file.'
      );
      return;
    }

    // Set the access token
    Mapbox.setAccessToken(token);

    console.log('[Mapbox] Initialized successfully');
  } catch (error) {
    console.error('[Mapbox] Failed to initialize:', error);
  }
}

/**
 * Default map styles
 *
 * Available Mapbox styles:
 * - streets-v12: Standard street map with labels
 * - outdoors-v12: Topographic style with terrain, perfect for cycling/walking
 * - light-v11: Minimal light style, clean and modern
 * - dark-v11: Dark theme for night mode
 * - satellite-v9: Satellite imagery only
 * - satellite-streets-v12: Satellite with street overlay
 * - navigation-day-v1: Optimized for navigation (day)
 * - navigation-night-v1: Optimized for navigation (night)
 */
export const MapStyles = {
  STREETS: 'mapbox://styles/mapbox/streets-v12',
  OUTDOORS: 'mapbox://styles/mapbox/outdoors-v12',
  LIGHT: 'mapbox://styles/mapbox/light-v11',
  DARK: 'mapbox://styles/mapbox/dark-v11',
  SATELLITE: 'mapbox://styles/mapbox/satellite-v9',
  SATELLITE_STREETS: 'mapbox://styles/mapbox/satellite-streets-v12',
  NAVIGATION_DAY: 'mapbox://styles/mapbox/navigation-day-v1',
  NAVIGATION_NIGHT: 'mapbox://styles/mapbox/navigation-night-v1',
} as const;

/**
 * Default camera settings
 */
export const DefaultCamera = {
  zoomLevel: 12,
  animationDuration: 1000,
  followUserMode: 'normal' as const,
  followUserZoomLevel: 16,
};

/**
 * Map configuration
 */
export const MapConfig = {
  // Show user location by default
  showUserLocation: true,

  // Compass position
  compassPosition: {
    top: 16,
    right: 16,
  },

  // Attribution position
  attributionPosition: {
    bottom: 8,
    right: 8,
  },

  // Gesture settings
  scrollEnabled: true,
  zoomEnabled: true,
  rotateEnabled: true,
  pitchEnabled: true,

  // Performance
  maxZoomLevel: 20,
  minZoomLevel: 3,
};

/**
 * Get map style based on theme and user preference
 */
export function getMapStyle(isDark: boolean, style?: keyof typeof MapStyles): string {
  if (style) {
    return MapStyles[style];
  }
  // Use light/dark styles that match app theme
  return isDark ? MapStyles.DARK : MapStyles.LIGHT;
}
