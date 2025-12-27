import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authAPI } from '../services/api';
import type { User, LoginRequest, RegisterRequest } from '../services/api';

const getApiErrorMessage = (err: unknown, fallback: string) => {
  if (err && typeof err === 'object') {
    const response = (err as { response?: { data?: { error?: string } } }).response;
    if (typeof response?.data?.error === 'string') {
      return response.data.error;
    }
  }
  if (err instanceof Error) return err.message;
  return fallback;
};

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (data: LoginRequest) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authAPI.login(data);
          localStorage.setItem('authToken', response.token);
          set({
            user: response.user,
            token: response.token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error: unknown) {
          const errorMessage = getApiErrorMessage(error, 'ログインに失敗しました');
          set({ error: errorMessage, isLoading: false });
          throw error;
        }
      },

      register: async (data: RegisterRequest) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authAPI.register(data);
          localStorage.setItem('authToken', response.token);
          set({
            user: response.user,
            token: response.token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error: unknown) {
          const errorMessage = getApiErrorMessage(error, '登録に失敗しました');
          set({ error: errorMessage, isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        try {
          await authAPI.logout();
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          localStorage.removeItem('authToken');
          localStorage.removeItem('selectedProjectId'); // Clear selected project on logout
          set({
            user: null,
            token: null,
            isAuthenticated: false,
          });
        }
      },

      checkAuth: async () => {
        const token = localStorage.getItem('authToken');
        if (!token) {
          localStorage.removeItem('selectedProjectId'); // Clear if not authenticated
          set({ isAuthenticated: false, user: null });
          return;
        }

        set({ isLoading: true, error: null });
        try {
          const response = await authAPI.getMe();
          set({
            user: response.user,
            token,
            isAuthenticated: true,
          });
        } catch {
          localStorage.removeItem('authToken');
          localStorage.removeItem('selectedProjectId'); // Clear on auth failure
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            error: '認証の確認に失敗しました',
          });
        } finally {
          set({ isLoading: false });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
