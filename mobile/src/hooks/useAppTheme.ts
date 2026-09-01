import { useTheme } from 'react-native-paper';

export interface AppThemeColors {
  primary: string;
  onPrimary: string;
  secondary: string;
  background: string;
  surface: string;
  surfaceVariant: string;
  text: string;
  textSecondary: string;
  onSurface: string;
  placeholder: string;
  border: string;
  error: string;
  success: string;
  warning: string;
  purple: string;
}

export interface AppTheme {
  colors: AppThemeColors;
  roundness: number;
}

export function useAppTheme(): AppTheme {
  return useTheme() as unknown as AppTheme;
}
