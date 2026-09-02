import * as SecureStore from 'expo-secure-store';
import { useThemeStore } from '../src/stores/themeStore';

beforeEach(() => {
  jest.clearAllMocks();
  useThemeStore.setState({ mode: 'system' });
});

describe('themeStore', () => {
  test('начальное состояние — system', () => {
    expect(useThemeStore.getState().mode).toBe('system');
  });

  test('setMode обновляет mode и сохраняет в SecureStore', async () => {
    await useThemeStore.getState().setMode('dark');

    expect(useThemeStore.getState().mode).toBe('dark');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('app_theme', 'dark');
  });

  test('setMode light', async () => {
    await useThemeStore.getState().setMode('light');

    expect(useThemeStore.getState().mode).toBe('light');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('app_theme', 'light');
  });

  test('initialize загружает сохранённую тему', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('dark');

    await useThemeStore.getState().initialize();

    expect(useThemeStore.getState().mode).toBe('dark');
  });

  test('initialize не меняет тему если сохранено невалидное значение', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('invalid');

    await useThemeStore.getState().initialize();

    expect(useThemeStore.getState().mode).toBe('system');
  });

  test('initialize не меняет тему если null', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

    await useThemeStore.getState().initialize();

    expect(useThemeStore.getState().mode).toBe('system');
  });
});
