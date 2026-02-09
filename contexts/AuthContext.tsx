import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '@/lib/api';
import { apiClient } from '@/lib/api/client';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: () => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const signOut = useCallback(async () => {
    await authApi.logout();
    setIsAuthenticated(false);
  }, []);

  // Register the 401 handler so the API client can trigger sign-out
  // when the backend rejects an invalid/expired token.
  useEffect(() => {
    apiClient.setOnUnauthorized(() => {
      console.warn('[Auth] Session expired — signing out');
      setIsAuthenticated(false);
    });
    return () => {
      apiClient.setOnUnauthorized(null);
    };
  }, []);

  useEffect(() => {
    async function checkAuthStatus() {
      try {
        const authenticated = await authApi.isAuthenticated();
        setIsAuthenticated(authenticated);
      } catch (e) {
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    }
    checkAuthStatus();
  }, []);

  const signIn = () => {
    setIsAuthenticated(true);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
