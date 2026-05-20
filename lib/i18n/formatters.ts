import i18n from './index';

/**
 * Format a date according to the current locale
 */
export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const locale = i18n.language;

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options,
  };

  return new Intl.DateTimeFormat(locale, defaultOptions).format(dateObj);
}

/**
 * Format a short date (e.g., "Oct 28")
 */
export function formatShortDate(date: Date | string): string {
  return formatDate(date, { month: 'short', day: 'numeric' });
}

/**
 * Format a number according to the current locale
 */
export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions
): string {
  const locale = i18n.language;
  return new Intl.NumberFormat(locale, options).format(value);
}

/**
 * Format a distance value
 */
export function formatDistance(kilometers: number, decimals: number = 2): string {
  return formatNumber(kilometers, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format a duration in minutes
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);

  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

/**
 * Format a speed value (km/h)
 */
export function formatSpeed(kmh: number, decimals: number = 1): string {
  return formatNumber(kmh, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format a weight value (kg)
 */
export function formatWeight(kg: number, decimals: number = 2): string {
  return formatNumber(kg, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// Intl.RelativeTimeFormat is not available in Hermes (production React Native builds).
// Use i18n keys for all relative time strings so it works on real devices.
function relativeTimeString(value: number, unit: string): string {
  const key = `common:time.${unit}${value === 1 ? '_one' : '_other'}`;
  const fallbacks: Record<string, string> = {
    'common:time.second_one': 'just now',
    'common:time.second_other': `${value}s ago`,
    'common:time.minute_one': '1 min ago',
    'common:time.minute_other': `${value} min ago`,
    'common:time.hour_one': '1 hr ago',
    'common:time.hour_other': `${value} hr ago`,
    'common:time.day_one': 'yesterday',
    'common:time.day_other': `${value} days ago`,
    'common:time.week_one': '1 week ago',
    'common:time.week_other': `${value} weeks ago`,
    'common:time.month_one': '1 month ago',
    'common:time.month_other': `${value} months ago`,
  };
  const translated = i18n.t(key, { count: value, defaultValue: fallbacks[key] ?? `${value} ${unit}s ago` });
  return translated;
}

/**
 * Format a relative time (e.g., "2 hours ago", "yesterday").
 * Uses i18n keys — safe on Hermes (no Intl.RelativeTimeFormat).
 */
export function formatRelativeTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);

  if (diffInSeconds < 60) return relativeTimeString(diffInSeconds, 'second');
  if (diffInSeconds < 3600) return relativeTimeString(Math.floor(diffInSeconds / 60), 'minute');
  if (diffInSeconds < 86400) return relativeTimeString(Math.floor(diffInSeconds / 3600), 'hour');
  if (diffInSeconds < 604800) return relativeTimeString(Math.floor(diffInSeconds / 86400), 'day');
  if (diffInSeconds < 2592000) return relativeTimeString(Math.floor(diffInSeconds / 604800), 'week');
  return relativeTimeString(Math.floor(diffInSeconds / 2592000), 'month');
}
