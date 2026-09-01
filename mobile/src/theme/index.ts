import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

const commonColors = {
  primary: '#0F766E',
  onPrimary: '#FFFFFF',
  secondary: '#0369A1',
  purple: '#7C3AED',
  success: '#059669',
  warning: '#D97706',
  danger: '#DC2626',
};

export const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: commonColors.primary,
    onPrimary: commonColors.onPrimary,
    secondary: commonColors.secondary,
    background: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceVariant: '#F1F5F9',
    text: '#0F172A',
    onSurface: '#0F172A',
    placeholder: '#64748B',
    textSecondary: '#64748B',
    border: '#E2E8F0',
    error: commonColors.danger,
    success: commonColors.success,
    warning: commonColors.warning,
    purple: commonColors.purple,
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
    onPrimary: '#FFFFFF',
    secondary: '#0369A1',
    background: '#0F172A',
    surface: '#1E293B',
    surfaceVariant: '#334155',
    text: '#F8FAFC',
    onSurface: '#F8FAFC',
    placeholder: '#64748B',
    border: 'rgba(255,255,255,0.08)',
    error: commonColors.danger,
    elevation: {
      level1: '#1E293B',
      level2: '#334155',
      level3: '#475569',
      level4: '#64748B',
      level5: '#94A3B8',
    },
  },
  roundness: 12,
  fonts: {
    ...MD3DarkTheme.fonts,
    headlineLarge: { ...MD3DarkTheme.fonts.headlineLarge, fontWeight: '700' as const },
    titleLarge: { ...MD3DarkTheme.fonts.titleLarge, fontWeight: '600' as const },
    titleMedium: { ...MD3DarkTheme.fonts.titleMedium, fontWeight: '600' as const },
  },
};
