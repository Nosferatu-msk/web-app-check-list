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
    text: '#0F172A',
    placeholder: '#64748B',
    border: '#E2E8F0',
    error: commonColors.danger,
  },
  roundness: 10,
};

export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: commonColors.secondary,
    secondary: commonColors.secondary,
    background: '#0F172A',
    surface: '#1E293B',
    text: '#F8FAFC',
    placeholder: '#94A3B8',
    border: '#334155',
    error: commonColors.danger,
  },
  roundness: 10,
};
