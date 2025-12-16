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
  password2?: string;
  first_name?: string;
  last_name?: string;
  // Backend requires these at registration
  date_of_birth?: string; // YYYY-MM-DD
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
}

export interface SocialLoginRequest {
  provider: 'google' | 'apple';
  token: string;
}

// Normalized auth response used by the app
export interface AuthResponse {
  access?: string; // JWT access token (if backend uses JWT)
  refresh?: string; // JWT refresh token (if backend uses JWT)
  token?: string; // DRF token (our backend returns this on login)
  user?: User;
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
  date_of_birth?: string;
  gender?: 'M' | 'F' | 'O' | '';
  joined_date?: string;
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
  name?: string;  // Backend uses 'name' not 'first_name'
  last_name?: string;
  email?: string;
  date_of_birth?: string;
  gender?: 'M' | 'F' | 'O' | '';
  profile?: {
    avatar?: string;
    bio?: string;
  };
}

// Auth API functions
export const authApi = {
  /**
   * Check if email exists in the system
   */
  async checkEmail(email: string): Promise<{ exists: boolean; email: string }> {
    try {
      const response = await apiClient.post<any>(
        '/api/email-check/',
        { email },
        { requiresAuth: false }
      );
      // Backend returns { email_exists: boolean }
      const exists = Boolean((response && (response.email_exists ?? response.exists)) || false);
      return { exists, email };
    } catch (error) {
      // If endpoint doesn't exist, fall back to attempting login
      return { exists: true, email };
    }
  },

  /**
   * Login with email and password
   */
  async login(data: LoginRequest): Promise<AuthResponse> {
    const response = await apiClient.post<any>('/api/login/', data, {
      requiresAuth: false,
    });

    // Normalize and store token (backend returns { token })
    const token = response?.access || response?.token || '';
    if (token) {
      await AsyncStorage.setItem('authToken', token);
    }

    return { token } as AuthResponse;
  },

  /**
   * Register a new user
   */
  async register(data: RegisterRequest): Promise<AuthResponse> {
    // Map frontend fields to backend expected payload
    const payload: Record<string, any> = {
      email: data.email,
      password: data.password,
      name: data.first_name ?? '',
      last_name: data.last_name ?? '',
    };

    if (data.date_of_birth) payload['date_of_birth'] = data.date_of_birth; // YYYY-MM-DD
    
    // Map gender to backend format (backend expects 'M', 'F', 'O' or 'Male', 'Female', 'Other')
    if (data.gender) {
      const genderMap: Record<string, string> = {
        'male': 'M',
        'female': 'F',
        'other': 'O',
        'prefer_not_to_say': 'O', // Map to 'Other' since backend doesn't have prefer_not_to_say
      };
      payload['gender'] = genderMap[data.gender] || data.gender;
    }

    // Create user (backend returns user data without token)
    await apiClient.post<any>('/api/register/', payload, { requiresAuth: false });

    // Immediately log in to obtain token
    const loginResult = await authApi.login({ email: data.email, password: data.password });
    return loginResult;
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
    }
    if (response.refresh) {
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

  /**
   * Upload profile avatar image
   * NOTE: This endpoint is not yet implemented on the backend
   * When backend is ready, uncomment and use this function
   */
  async uploadAvatar(imageUri: string): Promise<{ avatar: string }> {
    // Create form data
    const formData = new FormData();

    // Get file extension from URI
    const uriParts = imageUri.split('.');
    const fileType = uriParts[uriParts.length - 1];

    // Append the image file
    formData.append('avatar', {
      uri: imageUri,
      name: `avatar.${fileType}`,
      type: `image/${fileType}`,
    } as any);

    return apiClient.upload<{ avatar: string }>('/api/profile/avatar/', formData);
  },
};
