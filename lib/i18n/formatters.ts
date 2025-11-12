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

/**
 * Format a relative time (e.g., "2 hours ago", "yesterday")
 */
export function formatRelativeTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);

  const locale = i18n.language;

  // Less than a minute
  if (diffInSeconds < 60) {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
      -diffInSeconds,
      'second'
    );
  }

  // Less than an hour
  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
      -minutes,
      'minute'
    );
  }

  // Less than a day
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
      -hours,
      'hour'
    );
  }

  // Less than a week
  if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
      -days,
      'day'
    );
  }

  // Less than a month
  if (diffInSeconds < 2592000) {
    const weeks = Math.floor(diffInSeconds / 604800);
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
      -weeks,
      'week'
    );
  }

  // More than a month
  const months = Math.floor(diffInSeconds / 2592000);
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
    -months,
    'month'
  );
}
