import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MAP_LAYER_STORAGE_KEY = '@radzi:map_layer';

export type MapLayer = 'light' | 'dark' | 'streets' | 'outdoors' | 'satellite';

/** What the user picks: 'auto' follows the app theme (light/dark map). */
export type MapLayerPreference = 'auto' | 'streets' | 'outdoors' | 'satellite';

type ThemeName = 'light' | 'dark';

interface StoredMapLayer {
  layer: MapLayerPreference;
  /** Theme active when the layer was chosen; a theme change resets to 'auto'. */
  theme: ThemeName;
}

export interface UseMapLayerReturn {
  /** Effective map style to render. */
  selectedLayer: MapLayer;
  /** The user's choice, as shown in the style menu. */
  preference: MapLayerPreference;
  setPreference: (preference: MapLayerPreference) => void;
  isLoading: boolean;
}

function parseStored(raw: string | null): StoredMapLayer | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredMapLayer;
    if (parsed && typeof parsed.layer === 'string') return parsed;
  } catch {
    // Legacy format: a bare layer name. 'light'/'dark' meant the theme style.
    if (raw === 'streets' || raw === 'outdoors' || raw === 'satellite') {
      return { layer: raw, theme: 'light' };
    }
  }
  return null;
}

/**
 * Hook for the map style preference shared across the app.
 * The default style always matches the app theme, and every theme change
 * switches the map back to it — even if a custom style (streets, outdoors,
 * satellite) was chosen under the previous theme.
 */
export function useMapLayer(isDark: boolean): UseMapLayerReturn {
  const theme: ThemeName = isDark ? 'dark' : 'light';
  const [preference, setPreferenceState] = useState<MapLayerPreference>('auto');
  const [isLoading, setIsLoading] = useState(true);
  const previousTheme = useRef(theme);

  // Load saved preference; ignore it if it was chosen under a different theme.
  useEffect(() => {
    AsyncStorage.getItem(MAP_LAYER_STORAGE_KEY)
      .then((raw) => {
        const stored = parseStored(raw);
        if (stored && stored.theme === previousTheme.current) {
          setPreferenceState(stored.layer);
        }
      })
      .catch((error) => console.warn('[useMapLayer] Failed to load map layer:', error))
      .finally(() => setIsLoading(false));
  }, []);

  const save = useCallback((layer: MapLayerPreference, forTheme: ThemeName) => {
    const value: StoredMapLayer = { layer, theme: forTheme };
    AsyncStorage.setItem(MAP_LAYER_STORAGE_KEY, JSON.stringify(value)).catch((error) =>
      console.warn('[useMapLayer] Failed to save map layer:', error)
    );
  }, []);

  // Theme changed while mounted: snap back to the theme's map style.
  useEffect(() => {
    if (previousTheme.current === theme) return;
    previousTheme.current = theme;
    setPreferenceState('auto');
    save('auto', theme);
  }, [theme, save]);

  const setPreference = useCallback(
    (layer: MapLayerPreference) => {
      setPreferenceState(layer);
      save(layer, previousTheme.current);
    },
    [save]
  );

  return {
    selectedLayer: preference === 'auto' ? theme : preference,
    preference,
    setPreference,
    isLoading,
  };
}
