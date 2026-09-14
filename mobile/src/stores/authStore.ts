import { create } from 'zustand';
import { api } from '../api/client';

interface User {
  id: string;
  email: string;
  fullName?: string;
  role: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const response = await api.post('/auth/login', { email, password });
      const { user, accessToken, refreshToken } = response.data;

      // TODO: Сохранить токены в Secure Store
      // await SecureStore.setItemAsync('accessToken', accessToken);
      // await SecureStore.setItemAsync('refreshToken', refreshToken);

      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error: any) {
      set({ isLoading: false });
      throw new Error(error.response?.data?.message || 'Ошибка авторизации');
    }
  },

  logout: () => {
    // TODO: Очистить токены из Secure Store
    // await SecureStore.deleteItemAsync('accessToken');
    // await SecureStore.deleteItemAsync('refreshToken');

    set({ user: null, isAuthenticated: false });
  },

  setUser: (user: User) => {
    set({ user });
  },
}));
