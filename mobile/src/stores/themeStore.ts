import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const THEME_KEY = 'app_theme';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => Promise<void>;
  initialize: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'system',

  setMode: async (mode: ThemeMode) => {
    await SecureStore.setItemAsync(THEME_KEY, mode);
    set({ mode });
  },

  initialize: async () => {
    const savedMode = await SecureStore.getItemAsync(THEME_KEY);
    if (savedMode === 'light' || savedMode === 'dark' || savedMode === 'system') {
      set({ mode: savedMode });
    }
  },
}));
