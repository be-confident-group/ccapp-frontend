/**
 * Tracking Logger
 *
 * Lightweight in-memory log buffer with event emission for real-time
 * tracking diagnostics. Logs are displayed on the debug-tracking page.
 */

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
}

type LogListener = (entry: LogEntry) => void;

const MAX_LOG_ENTRIES = 200;
const logBuffer: LogEntry[] = [];
const listeners: Set<LogListener> = new Set();

export function trackingLog(level: LogLevel, message: string): void {
  const entry: LogEntry = { timestamp: Date.now(), level, message };
  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOG_ENTRIES) {
    logBuffer.shift();
  }
  for (const listener of listeners) {
    listener(entry);
  }
}

export function onTrackingLog(listener: LogListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getTrackingLogBuffer(): LogEntry[] {
  return [...logBuffer];
}

export function clearTrackingLogBuffer(): void {
  logBuffer.length = 0;
}
