import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import api from '../api/client';

interface User {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    const { user, accessToken, refreshToken } = response.data;

    await SecureStore.setItemAsync('refreshToken', refreshToken);
    await SecureStore.setItemAsync('accessToken', accessToken);

    set({
      user,
      accessToken,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('refreshToken');
    await SecureStore.deleteItemAsync('accessToken');

    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  initialize: async () => {
    try {
      const accessToken = await SecureStore.getItemAsync('accessToken');
      
      if (accessToken) {
        // Проверяем валидность токена через API
        const response = await api.get('/profile', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        
        set({
          user: response.data,
          accessToken,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      // Токен невалиден — очищаем
      await SecureStore.deleteItemAsync('refreshToken');
      await SecureStore.deleteItemAsync('accessToken');
      set({ isLoading: false });
    }
  },
}));
