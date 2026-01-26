import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

if (!API_URL) {
  console.error('EXPO_PUBLIC_API_URL is not defined in environment variables');
  console.warn('API features will not be available. Please configure environment variables in EAS or .env file.');
}

interface RequestConfig extends RequestInit {
  requiresAuth?: boolean;
}

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string | undefined) {
    this.baseURL = baseURL || '';
  }

  private checkConfiguration(): boolean {
    if (!this.baseURL) {
      console.error('[API] API_URL not configured. Please set EXPO_PUBLIC_API_URL.');
      return false;
    }
    return true;
  }

  private async getAuthToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('authToken');
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  private async request<T>(
    endpoint: string,
    config: RequestConfig = {}
  ): Promise<T> {
    // Check if API is configured
    if (!this.checkConfiguration()) {
      throw new Error('API not configured. Please set EXPO_PUBLIC_API_URL in environment variables.');
    }

    const { requiresAuth = true, headers = {}, ...restConfig } = config;

    const url = `${this.baseURL}${endpoint}`;

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(headers as Record<string, string>),
    };

    // Add auth token if required
    if (requiresAuth) {
      const token = await this.getAuthToken();
      if (token) {
        requestHeaders['Authorization'] = `Bearer ${token}`;
      } else {
        // no token available
      }
    }

    try {
      const response = await fetch(url, {
        ...restConfig,
        headers: requestHeaders,
      });

      // Handle non-2xx responses
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        try {
          const text = await response.text();
          
          if (text) {
            const errorData = JSON.parse(text);
            
            // Handle different error response formats
            if (errorData.message) {
              errorMessage = errorData.message;
            } else if (errorData.error) {
              errorMessage = errorData.error;
            } else if (errorData.detail) {
              errorMessage = errorData.detail;
            } else if (typeof errorData === 'object') {
              // Handle validation errors (field-specific errors)
              const errors: string[] = [];
              for (const [field, messages] of Object.entries(errorData)) {
                if (Array.isArray(messages)) {
                  errors.push(`${field}: ${messages.join(', ')}`);
                } else if (typeof messages === 'string') {
                  errors.push(`${field}: ${messages}`);
                }
              }
              if (errors.length > 0) {
                errorMessage = errors.join('\n');
              }
            }
          }
        } catch (e) {
          // If JSON parsing fails, use status text
          errorMessage = response.statusText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }

      // Handle empty responses
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        return {} as T;
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        // Check if it's a network error
        if (error.message.includes('Network request failed') || error.message.includes('fetch')) {
          throw new Error('Network error: Unable to reach the server. Please check your connection.');
        }
        throw error;
      }
      throw new Error('An unexpected error occurred');
    }
  }

  async get<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'GET' });
  }

  async post<T>(
    endpoint: string,
    data?: unknown,
    config?: RequestConfig
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(
    endpoint: string,
    data?: unknown,
    config?: RequestConfig
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(
    endpoint: string,
    data?: unknown,
    config?: RequestConfig
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'DELETE' });
  }

  /**
   * Upload multipart/form-data (for file uploads)
   */
  async upload<T>(
    endpoint: string,
    formData: FormData,
    config?: RequestConfig
  ): Promise<T> {
    // Check if API is configured
    if (!this.checkConfiguration()) {
      throw new Error('API not configured. Please set EXPO_PUBLIC_API_URL in environment variables.');
    }

    const { requiresAuth = true, headers = {}, ...restConfig } = config || {};
    const url = `${this.baseURL}${endpoint}`;

    const requestHeaders: Record<string, string> = {
      ...(headers as Record<string, string>),
      // Don't set Content-Type for FormData - browser/runtime will set it with boundary
    };

    // Add auth token if required
    if (requiresAuth) {
      const token = await this.getAuthToken();
      if (token) {
        requestHeaders['Authorization'] = `Bearer ${token}`;
      }
    }

    try {
      const response = await fetch(url, {
        ...restConfig,
        method: 'POST',
        headers: requestHeaders,
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const text = await response.text();
          if (text) {
            const errorData = JSON.parse(text);
            if (errorData.message) {
              errorMessage = errorData.message;
            } else if (errorData.error) {
              errorMessage = errorData.error;
            } else if (errorData.detail) {
              errorMessage = errorData.detail;
            }
          }
        } catch (e) {
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        return {} as T;
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Network request failed') || error.message.includes('fetch')) {
          throw new Error('Network error: Unable to reach the server. Please check your connection.');
        }
        throw error;
      }
      throw new Error('An unexpected error occurred');
    }
  }
}

export const apiClient = new ApiClient(API_URL);
