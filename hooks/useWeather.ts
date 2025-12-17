/**
 * useWeather Hook
 *
 * Fetches and manages weather data based on user's location
 */

import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import { WeatherService, type WeatherData } from '@/lib/services/WeatherService';

const WEATHER_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

interface UseWeatherReturn {
  weather: WeatherData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useWeather(): UseWeatherReturn {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWeather = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('[useWeather] Requesting location permissions...');
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      console.log('[useWeather] Permission status:', status);

      if (status !== 'granted') {
        throw new Error('Location permission denied');
      }

      console.log('[useWeather] Getting current position...');
      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      console.log('[useWeather] Got location:', location.coords.latitude, location.coords.longitude);

      // Fetch weather
      console.log('[useWeather] Fetching weather data...');
      const weatherData = await WeatherService.fetchWeatherByCoords(
        location.coords.latitude,
        location.coords.longitude
      );
      console.log('[useWeather] Weather data received:', weatherData);

      setWeather(weatherData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch weather';
      console.error('[useWeather] Error fetching weather:', errorMessage);
      console.error('[useWeather] Full error:', err);

      setError(errorMessage);

      // Always provide fallback weather to avoid showing "Unknown"
      // This ensures a good user experience even when weather API fails
      console.log('[useWeather] Using fallback weather data');
      setWeather({
        temperature: 15,
        city: 'Weather unavailable',
        condition: 'Clouds',
        description: 'Unable to fetch weather',
        icon: 'weather-partly-cloudy',
        humidity: 65,
        windSpeed: 12,
        feelsLike: 14,
        timestamp: Date.now(),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch weather on mount
  useEffect(() => {
    fetchWeather();
  }, [fetchWeather]);

  // Auto-refresh weather data every 30 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchWeather();
    }, WEATHER_CACHE_DURATION);

    return () => clearInterval(interval);
  }, [fetchWeather]);

  return {
    weather,
    loading,
    error,
    refresh: fetchWeather,
  };
}
