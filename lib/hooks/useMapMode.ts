import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MapViewMode, HeatmapMode, FeedbackMode, MapModeState } from '@/types/mapMode';

const MAP_MODE_STORAGE_KEY = '@radzi:map_mode';

const DEFAULT_MAP_MODE: MapModeState = {
  viewMode: 'feedback',
  heatmapMode: 'personal',
  feedbackMode: 'community',
};

export interface UseMapModeReturn extends MapModeState {
  setViewMode: (mode: MapViewMode) => void;
  setHeatmapMode: (mode: HeatmapMode) => void;
  setFeedbackMode: (mode: FeedbackMode) => void;
  toggleHeatmapMode: () => void;
  toggleFeedbackMode: () => void;
  isLoading: boolean;
}

export function useMapMode(): UseMapModeReturn {
  const [state, setState] = useState<MapModeState>(DEFAULT_MAP_MODE);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved mode from storage on mount
  useEffect(() => {
    loadMapMode();
  }, []);

  const loadMapMode = async () => {
    try {
      const saved = await AsyncStorage.getItem(MAP_MODE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as MapModeState;
        setState(parsed);
      }
    } catch (error) {
      console.error('[useMapMode] Failed to load map mode:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveMapMode = async (newState: MapModeState) => {
    try {
      await AsyncStorage.setItem(MAP_MODE_STORAGE_KEY, JSON.stringify(newState));
    } catch (error) {
      console.error('[useMapMode] Failed to save map mode:', error);
    }
  };

  const setViewMode = useCallback((mode: MapViewMode) => {
    setState((prev) => {
      const newState = { ...prev, viewMode: mode };
      saveMapMode(newState);
      return newState;
    });
  }, []);

  const setHeatmapMode = useCallback((mode: HeatmapMode) => {
    setState((prev) => {
      const newState = { ...prev, heatmapMode: mode };
      saveMapMode(newState);
      return newState;
    });
  }, []);

  const setFeedbackMode = useCallback((mode: FeedbackMode) => {
    setState((prev) => {
      const newState = { ...prev, feedbackMode: mode };
      saveMapMode(newState);
      return newState;
    });
  }, []);

  const toggleHeatmapMode = useCallback(() => {
    setState((prev) => {
      const newMode: HeatmapMode = prev.heatmapMode === 'global' ? 'personal' : 'global';
      const newState = { ...prev, heatmapMode: newMode };
      saveMapMode(newState);
      return newState;
    });
  }, []);

  const toggleFeedbackMode = useCallback(() => {
    setState((prev) => {
      const newMode: FeedbackMode = prev.feedbackMode === 'community' ? 'personal' : 'community';
      const newState = { ...prev, feedbackMode: newMode };
      saveMapMode(newState);
      return newState;
    });
  }, []);

  return {
    ...state,
    setViewMode,
    setHeatmapMode,
    setFeedbackMode,
    toggleHeatmapMode,
    toggleFeedbackMode,
    isLoading,
  };
}
