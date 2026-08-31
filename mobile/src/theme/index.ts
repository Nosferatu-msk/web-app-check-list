import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

const commonColors = {
  primary: '#0F766E',
  secondary: '#14B8A6',
  accent: '#0369A1',
  success: '#059669',
  warning: '#D97706',
  danger: '#DC2626',
};

export const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: commonColors.primary,
    secondary: commonColors.secondary,
    background: '#F8FAFC',
    surface: '#FFFFFF',
    'surfaceVariant': '#F1F5F9',
    text: '#0F172A',
    'onSurface': '#0F172A',
    placeholder: '#64748B',
    border: '#E2E8F0',
    error: commonColors.danger,
    elevation: {
      level1: '#FFFFFF',
      level2: '#F8FAFC',
      level3: '#F1F5F9',
      level4: '#E2E8F0',
      level5: '#CBD5E1',
    },
  },
  roundness: 12,
  fonts: {
    ...MD3LightTheme.fonts,
    headlineLarge: { ...MD3LightTheme.fonts.headlineLarge, fontWeight: '700' as const },
    titleLarge: { ...MD3LightTheme.fonts.titleLarge, fontWeight: '600' as const },
    titleMedium: { ...MD3LightTheme.fonts.titleMedium, fontWeight: '600' as const },
  },
};

export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#14B8A6',
    secondary: '#14B8A6',
    background: '#020617',
    surface: '#192134',
    'surfaceVariant': '#1E293B',
    text: '#F8FAFC',
    'onSurface': '#F8FAFC',
    placeholder: '#94A3B8',
    border: 'rgba(255,255,255,0.08)',
    error: commonColors.danger,
    elevation: {
      level1: '#192134',
      level2: '#1E293B',
      level3: '#334155',
      level4: '#475569',
      level5: '#64748B',
    },
  },
  roundness: 10,
};
