import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';

export const theme = {
  light: {
    ...MD3LightTheme,
    colors: {
      ...MD3LightTheme.colors,
      primary: '#0F766E',
      secondary: '#64748B',
      background: '#F8FAFC',
      surface: '#FFFFFF',
      text: '#0F172A',
      outline: '#E2E8F0',
      error: '#DC2626',
    },
  },
  dark: {
    ...MD3DarkTheme,
    colors: {
      ...MD3DarkTheme.colors,
      primary: '#14B8A6',
      secondary: '#94A3B8',
      background: '#0F172A',
      surface: '#1E293B',
      text: '#F8FAFC',
      outline: '#334155',
      error: '#EF4444',
    },
  },
};
