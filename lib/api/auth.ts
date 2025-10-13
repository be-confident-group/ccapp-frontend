import { apiClient } from './client';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  password2: string;
  first_name?: string;
  last_name?: string;
}

export interface SocialLoginRequest {
  provider: 'google' | 'apple';
  token: string;
}

export interface AuthResponse {
  access: string;
  refresh: string;
  user: User;
}

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  profile?: UserProfile;
}

export interface UserProfile {
  avatar?: string;
  bio?: string;
  total_distance?: number;
  total_rides?: number;
  co2_saved?: number;
  current_streak?: number;
}

export interface ChangePasswordRequest {
  old_password: string;
  new_password: string;
  new_password2: string;
}

export interface ProfileUpdateRequest {
  first_name?: string;
  last_name?: string;
  email?: string;
  profile?: {
    avatar?: string;
    bio?: string;
  };
}

// Auth API functions
export const authApi = {
  /**
   * Login with email and password
   */
  async login(data: LoginRequest): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/api/login/', data, {
      requiresAuth: false,
    });

    // Store tokens
    if (response.access) {
      await AsyncStorage.setItem('authToken', response.access);
      await AsyncStorage.setItem('refreshToken', response.refresh);
    }

    return response;
  },

  /**
   * Register a new user
   */
  async register(data: RegisterRequest): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/api/register/', data, {
      requiresAuth: false,
    });

    // Store tokens
    if (response.access) {
      await AsyncStorage.setItem('authToken', response.access);
      await AsyncStorage.setItem('refreshToken', response.refresh);
    }

    return response;
  },

  /**
   * Social login (Google/Apple)
   */
  async socialLogin(data: SocialLoginRequest): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/api/social-login/', data, {
      requiresAuth: false,
    });

    // Store tokens
    if (response.access) {
      await AsyncStorage.setItem('authToken', response.access);
      await AsyncStorage.setItem('refreshToken', response.refresh);
    }

    return response;
  },

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      await apiClient.post('/api/logout/', {});
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      // Clear tokens regardless of API success
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('refreshToken');
    }
  },

  /**
   * Get current user profile
   */
  async getProfile(): Promise<User> {
    return apiClient.get<User>('/api/profile/');
  },

  /**
   * Update user profile
   */
  async updateProfile(data: ProfileUpdateRequest): Promise<User> {
    return apiClient.put<User>('/api/profile/update/', data);
  },

  /**
   * Change password
   */
  async changePassword(data: ChangePasswordRequest): Promise<void> {
    return apiClient.put<void>('/api/change-password/', data);
  },

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const token = await AsyncStorage.getItem('authToken');
      return !!token;
    } catch {
      return false;
    }
  },

  /**
   * Get stored auth token
   */
  async getToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('authToken');
    } catch {
      return null;
    }
  },
};
