import { useState, useEffect } from 'react';
import i18next from 'i18next';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { Location } from './usePrayerTimes';
import { fetchWithTimeout, withTimeout } from '../lib/fetchWithTimeout';
import { createLogger } from '@/utils/logger';

const log = createLogger('[Weather]');

export interface WeatherData {
  current: {
    temperature: number;
    condition: string;
    location: string;
    icon?: string;
  };
  forecast: Array<{
    day: string;
    high: number;
    low: number;
    condition: string;
    date: string;
  }>;
}

interface OpenMeteoCurrent {
  temperature_2m: number;
  weather_code: number;
}

interface OpenMeteoDaily {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  weather_code: number[];
}

interface OpenMeteoResponse {
  current: {
    temperature_2m: number;
    weather_code: number;
  };
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weather_code: number[];
  };
}

function isOpenMeteoResponse(data: unknown): data is OpenMeteoResponse {
  if (!data || typeof data !== 'object') return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as Record<string, any>;
  if (!d.current || typeof d.current !== 'object') return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const current = d.current as Record<string, any>;
  if (typeof current.temperature_2m !== 'number' || typeof current.weather_code !== 'number') return false;
  
  if (!d.daily || typeof d.daily !== 'object') return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const daily = d.daily as Record<string, any>;
  if (!Array.isArray(daily.time) || !Array.isArray(daily.temperature_2m_max) || 
      !Array.isArray(daily.temperature_2m_min) || !Array.isArray(daily.weather_code)) return false;

  const len = daily.time.length;
  if (len === 0 || daily.temperature_2m_max.length !== len || 
      daily.temperature_2m_min.length !== len || daily.weather_code.length !== len) {
    return false;
  }

  // Check first element types as a heuristic
  if (typeof daily.time[0] !== 'string' || typeof daily.temperature_2m_max[0] !== 'number' ||
      typeof daily.temperature_2m_min[0] !== 'number' || typeof daily.weather_code[0] !== 'number') {
    return false;
  }

  return true;
}

async function fetchOpenMeteo(url: string): Promise<OpenMeteoResponse> {
  if (Capacitor.isNativePlatform()) {
    const response = await withTimeout(
      CapacitorHttp.get({ url }),
      8000,
      'Weather request timeout',
    );
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Weather API error: ${response.status}`);
    }

    let parsedData: unknown;
    if (typeof response.data === 'string') {
      try {
        parsedData = JSON.parse(response.data);
      } catch {
        throw new Error('Unable to parse weather response');
      }
    } else {
      parsedData = response.data;
    }

    if (!isOpenMeteoResponse(parsedData)) {
      throw new Error('Invalid weather response format');
    }
    return parsedData;
  }

  const response = await fetchWithTimeout(url, {}, 8000);
  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`);
  }

  const parsedData: unknown = await response.json();
  if (!isOpenMeteoResponse(parsedData)) {
    throw new Error('Invalid weather response format');
  }
  return parsedData;
}

// Weather condition translation via i18n (supports all 63 languages)
function getWeatherCondition(code: number, lang: string = 'en'): string {
  return i18next.t(`weather.conditions.${code}`, { lng: lang});
}

function formatDayName(dateStr: string, index: number, lang: string = 'en'): string {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const forecastDate = new Date(date);
  forecastDate.setHours(0, 0, 0, 0);

  const diffTime = forecastDate.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return i18next.t('weather.today', { lng: lang});
  }
  if (diffDays === 1) {
    return i18next.t('weather.tomorrow', { lng: lang});
  }

  // Use Intl.DateTimeFormat for locale-aware weekday names (supports all BCP47 codes)
  try {
    return date.toLocaleDateString(lang, { weekday: 'long' });
  } catch {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  }
}

export function useWeather(location: Location | null, language: string = 'en') {
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!location || !location.latitude || !location.longitude) {
      setLoading(false);
      return;
    }

    const fetchWeather = async () => {
      setLoading(true);
      setError(null);

      try {
        // Open-Meteo API - Free, no API key required, works globally
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&forecast_days=7`;
        const data = await fetchOpenMeteo(url);

        // Format current weather
        const currentWeather: WeatherData['current'] = {
          temperature: Math.round(data.current.temperature_2m),
          condition: getWeatherCondition(data.current.weather_code, language),
          location: location.city || `${location.latitude.toFixed(2)}, ${location.longitude.toFixed(2)}`,
        };

        // Format forecast - 7 days
        const forecast: WeatherData['forecast'] = data.daily.time.slice(0, 7).map((dateStr, index) => ({
          day: formatDayName(dateStr, index, language),
          high: Math.round(data.daily.temperature_2m_max[index]),
          low: Math.round(data.daily.temperature_2m_min[index]),
          condition: getWeatherCondition(data.daily.weather_code[index], language),
          date: dateStr,
        }));

        setWeatherData({
          current: currentWeather,
          forecast,
        });
      } catch (err) {
        log.error('Failed to fetch weather', err);
        setError(err instanceof Error ? err.message : 'Unable to load weather forecast');
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.latitude, location?.longitude, location?.city, language]);

  return { weatherData, loading, error };
}
