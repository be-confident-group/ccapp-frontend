/**
 * Weather Service
 *
 * Fetches current weather data from OpenWeatherMap API
 */

const API_KEY = process.env.EXPO_PUBLIC_OPENWEATHERMAP_API_KEY;
const BASE_URL = 'https://api.openweathermap.org/data/2.5/weather';

export interface WeatherData {
  temperature: number; // in Celsius
  city: string;
  condition: string; // e.g., "Clear", "Clouds", "Rain"
  description: string; // e.g., "clear sky", "few clouds"
  icon: string; // MaterialCommunityIcons name
  humidity: number;
  windSpeed: number;
  feelsLike: number;
  timestamp: number;
}

/**
 * Map OpenWeatherMap icon codes to MaterialCommunityIcons
 */
function mapWeatherIcon(iconCode: string, condition: string): string {
  // Icon codes: https://openweathermap.org/weather-conditions
  // Format: XXd (day) or XXn (night)
  const code = iconCode.substring(0, 2);
  const isNight = iconCode.endsWith('n');

  switch (code) {
    case '01': // Clear sky
      return isNight ? 'weather-night' : 'weather-sunny';
    case '02': // Few clouds
      return isNight ? 'weather-night-partly-cloudy' : 'weather-partly-cloudy';
    case '03': // Scattered clouds
    case '04': // Broken clouds
      return 'weather-cloudy';
    case '09': // Shower rain
    case '10': // Rain
      return isNight ? 'weather-rainy' : 'weather-pouring';
    case '11': // Thunderstorm
      return 'weather-lightning-rainy';
    case '13': // Snow
      return 'weather-snowy';
    case '50': // Mist/Fog
      return 'weather-fog';
    default:
      // Fallback based on condition
      if (condition.toLowerCase().includes('rain')) return 'weather-rainy';
      if (condition.toLowerCase().includes('cloud')) return 'weather-cloudy';
      if (condition.toLowerCase().includes('snow')) return 'weather-snowy';
      if (condition.toLowerCase().includes('thunder')) return 'weather-lightning';
      return 'weather-partly-cloudy';
  }
}

/**
 * Fetch current weather by coordinates
 */
export async function fetchWeatherByCoords(
  latitude: number,
  longitude: number
): Promise<WeatherData> {
  if (!API_KEY) {
    throw new Error('OpenWeatherMap API key not configured');
  }

  try {
    const url = `${BASE_URL}?lat=${latitude}&lon=${longitude}&units=metric&appid=${API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    return {
      temperature: Math.round(data.main.temp),
      city: data.name,
      condition: data.weather[0].main,
      description: data.weather[0].description,
      icon: mapWeatherIcon(data.weather[0].icon, data.weather[0].main),
      humidity: data.main.humidity,
      windSpeed: Math.round(data.wind.speed * 3.6), // Convert m/s to km/h
      feelsLike: Math.round(data.main.feels_like),
      timestamp: Date.now(),
    };
  } catch (error) {
    // Only log non-401 errors (401 is expected when API key is activating)
    const is401Error = error instanceof Error && error.message.includes('401');
    if (!is401Error) {
      console.error('[WeatherService] Error fetching weather:', error);
    }
    throw error;
  }
}

/**
 * Fetch current weather by city name
 */
export async function fetchWeatherByCity(cityName: string): Promise<WeatherData> {
  if (!API_KEY) {
    throw new Error('OpenWeatherMap API key not configured');
  }

  try {
    const url = `${BASE_URL}?q=${encodeURIComponent(cityName)}&units=metric&appid=${API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    return {
      temperature: Math.round(data.main.temp),
      city: data.name,
      condition: data.weather[0].main,
      description: data.weather[0].description,
      icon: mapWeatherIcon(data.weather[0].icon, data.weather[0].main),
      humidity: data.main.humidity,
      windSpeed: Math.round(data.wind.speed * 3.6),
      feelsLike: Math.round(data.main.feels_like),
      timestamp: Date.now(),
    };
  } catch (error) {
    // Only log non-401 errors (401 is expected when API key is activating)
    const is401Error = error instanceof Error && error.message.includes('401');
    if (!is401Error) {
      console.error('[WeatherService] Error fetching weather:', error);
    }
    throw error;
  }
}

export const WeatherService = {
  fetchWeatherByCoords,
  fetchWeatherByCity,
};
