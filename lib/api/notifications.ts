/**
 * Push-notification API.
 * Endpoints:
 *   POST   /api/push-token/              { token }
 *   DELETE /api/push-token/              { token }
 *   GET    /api/notification-preferences/
 *   PUT    /api/notification-preferences/
 */

import { apiClient } from './client';

export interface NotificationPreferences {
  likes: boolean;
  comments: boolean;
  club_activity: boolean;
  join_requests: boolean;
}

export async function registerPushToken(token: string): Promise<void> {
  await apiClient.post('/api/push-token/', { token });
}

export async function deletePushToken(token: string): Promise<void> {
  // DELETE with a JSON body — pass body via config since apiClient.delete passes extra config
  // through to the underlying fetch call.
  await apiClient.delete('/api/push-token/', { body: JSON.stringify({ token }) } as Parameters<typeof apiClient.delete>[1]);
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  return apiClient.get<NotificationPreferences>('/api/notification-preferences/');
}

export async function updateNotificationPreferences(
  prefs: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  return apiClient.put<NotificationPreferences>('/api/notification-preferences/', prefs);
}
