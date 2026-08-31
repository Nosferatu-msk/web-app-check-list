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
  needsUnlock: boolean; // true = показать экран разблокировки (PIN/биометрия)
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
  unlock: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,
  needsUnlock: false,

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
      needsUnlock: false,
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
      needsUnlock: false,
    });
  },

  initialize: async () => {
    try {
      const accessToken = await SecureStore.getItemAsync('accessToken');
      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      
      // Если есть refresh token — пользователь ранее входил, нужен экран разблокировки
      if (refreshToken && !accessToken) {
        set({ isLoading: false, needsUnlock: true });
        return;
      }

      if (refreshToken && accessToken) {
        // Проверяем валидность токена через API
        try {
          const response = await api.get('/profile', {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          
          set({
            user: response.data,
            accessToken,
            isAuthenticated: true,
            isLoading: false,
            needsUnlock: false,
          });
        } catch (apiError) {
          // Токен истёк, но refresh token есть — показать экран разблокировки
          // Не очищаем refresh token — он нужен для получения нового access token
          await SecureStore.deleteItemAsync('accessToken');
          set({ isLoading: false, needsUnlock: true });
        }
      } else {
        // Нет токенов — нужен вход
        set({ isLoading: false, needsUnlock: false });
      }
    } catch (error) {
      await SecureStore.deleteItemAsync('refreshToken');
      await SecureStore.deleteItemAsync('accessToken');
      set({ isLoading: false, needsUnlock: false });
    }
  },

  unlock: async () => {
    // Получить новый access token через refresh token
    try {
      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      if (!refreshToken) {
        throw new Error('No refresh token');
      }

      const response = await api.post('/auth/refresh', { refreshToken });
      const { user, accessToken, refreshToken: newRefreshToken } = response.data;

      await SecureStore.setItemAsync('accessToken', accessToken);
      await SecureStore.setItemAsync('refreshToken', newRefreshToken);

      set({
        user,
        accessToken,
        isAuthenticated: true,
        isLoading: false,
        needsUnlock: false,
      });
    } catch (error) {
      // Refresh token истёк — нужен полный вход
      await SecureStore.deleteItemAsync('refreshToken');
      await SecureStore.deleteItemAsync('accessToken');
      set({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isLoading: false,
        needsUnlock: false,
      });
    }
  },
}));
