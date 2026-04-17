/**
 * Home screen AI-generated messages API.
 * Backend endpoint: GET /api/profile/home-messages/
 * Server-caches the result per user for 24h. Rate-limited (429 on abuse).
 */

import { apiClient } from './client';

export interface HomeMessages {
  stats_message: string;
  streak_message: string;
  trophy_message: string;
}

export async function getHomeMessages(): Promise<HomeMessages> {
  return apiClient.get<HomeMessages>('/api/profile/home-messages/');
}
