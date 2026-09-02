// Jest setup file
// Мок для useAppTheme
jest.mock('<rootDir>/src/hooks/useAppTheme', () => ({
  useAppTheme: () => ({
    colors: {
      primary: '#0F766E',
      onPrimary: '#FFFFFF',
      secondary: '#0369A1',
      background: '#F8FAFC',
      surface: '#FFFFFF',
      surfaceVariant: '#F1F5F9',
      text: '#0F172A',
      onSurface: '#0F172A',
      placeholder: '#64748B',
      border: '#E2E8F0',
      error: '#DC2626',
      success: '#059669',
      warning: '#D97706',
      purple: '#7C3AED',
    },
  }),
}), { virtual: true });
