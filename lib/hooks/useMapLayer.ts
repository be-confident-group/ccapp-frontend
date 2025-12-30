import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MAP_LAYER_STORAGE_KEY = '@radzi:map_layer';

export type MapLayer = 'light' | 'dark' | 'streets' | 'outdoors' | 'satellite';

export interface UseMapLayerReturn {
  selectedLayer: MapLayer;
  setSelectedLayer: (layer: MapLayer) => void;
  isLoading: boolean;
}

/**
 * Hook for managing persistent map layer selection across the app.
 * Stores user's preferred map style in AsyncStorage.
 */
export function useMapLayer(isDark: boolean): UseMapLayerReturn {
  const defaultLayer: MapLayer = isDark ? 'dark' : 'light';
  const [selectedLayer, setSelectedLayerState] = useState<MapLayer>(defaultLayer);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved layer from storage on mount
  useEffect(() => {
    loadMapLayer();
  }, []);

  const loadMapLayer = async () => {
    try {
      const saved = await AsyncStorage.getItem(MAP_LAYER_STORAGE_KEY);
      if (saved) {
        const parsed = saved as MapLayer;
        setSelectedLayerState(parsed);
      }
    } catch (error) {
      console.error('[useMapLayer] Failed to load map layer:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveMapLayer = async (layer: MapLayer) => {
    try {
      await AsyncStorage.setItem(MAP_LAYER_STORAGE_KEY, layer);
    } catch (error) {
      console.error('[useMapLayer] Failed to save map layer:', error);
    }
  };

  const setSelectedLayer = useCallback((layer: MapLayer) => {
    setSelectedLayerState(layer);
    saveMapLayer(layer);
  }, []);

  return {
    selectedLayer,
    setSelectedLayer,
    isLoading,
  };
}
