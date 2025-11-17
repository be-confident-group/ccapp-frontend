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

      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission denied');
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      // Fetch weather
      const weatherData = await WeatherService.fetchWeatherByCoords(
        location.coords.latitude,
        location.coords.longitude
      );

      setWeather(weatherData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch weather';

      // Only log non-401 errors (401 is expected when API key is activating)
      if (!errorMessage.includes('401')) {
        console.error('[useWeather] Error:', errorMessage);
      }

      setError(errorMessage);

      // Set fallback data for development/testing
      setWeather({
        temperature: 15,
        city: 'London',
        condition: 'Clouds',
        description: 'few clouds',
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
