import { create } from 'zustand';
import axios from 'axios';

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: 'admin' | 'operator' | 'viewer';
  permissions: string[];
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  setAuth: (user: AuthUser, accessToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  clearAuth: () => void;
  initializeAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isInitializing: true,

  setAuth: (user, accessToken) =>
    set({
      user,
      accessToken,
      isAuthenticated: true,
      isInitializing: false
    }),

  setAccessToken: (accessToken) =>
    set({
      accessToken,
      isAuthenticated: true
    }),

  clearAuth: () =>
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isInitializing: false
    }),

  initializeAuth: async () => {
    try {
      const response = await axios.post<{
        success: boolean;
        data: { accessToken: string; user: AuthUser };
      }>('/api/auth/refresh', {}, { withCredentials: true });

      if (response.data?.success && response.data.data) {
        set({
          user: response.data.data.user,
          accessToken: response.data.data.accessToken,
          isAuthenticated: true,
          isInitializing: false
        });
        return;
      }
      set({ isInitializing: false });
    } catch {
      set({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isInitializing: false
      });
    }
  }
}));
