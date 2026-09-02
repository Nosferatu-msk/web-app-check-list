import * as SecureStore from 'expo-secure-store';

jest.mock('../src/api/client', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    get: jest.fn(),
  },
}));

import api from '../src/api/client';
import { useAuthStore } from '../src/stores/authStore';

const mockedApi = api as jest.Mocked<typeof api>;

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({
    user: null,
    accessToken: null,
    isAuthenticated: false,
    isLoading: true,
    needsUnlock: false,
  });
});

describe('authStore — login', () => {
  test('успешный логин сохраняет user и токены', async () => {
    const mockUser = { id: '1', fullName: 'Тест', email: 'test@test.com', role: 'engineer' };
    (mockedApi.post as jest.Mock).mockResolvedValue({
      data: {
        user: mockUser,
        accessToken: 'access-123',
        refreshToken: 'refresh-123',
      },
    });

    await useAuthStore.getState().login('test@test.com', 'pass');

    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.accessToken).toBe('access-123');
    expect(state.isAuthenticated).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('refreshToken', 'refresh-123');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('accessToken', 'access-123');
  });
});

describe('authStore — logout', () => {
  test('logout очищает состояние и SecureStore', async () => {
    useAuthStore.setState({
      user: { id: '1', fullName: 'Тест', email: 'test@test.com', role: 'engineer' },
      accessToken: 'access-123',
      isAuthenticated: true,
      isLoading: false,
      needsUnlock: false,
    });

    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('refreshToken');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('accessToken');
  });
});

describe('authStore — initialize', () => {
  test('нет токенов — нужен логин', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

    await useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.needsUnlock).toBe(false);
    expect(state.isAuthenticated).toBe(false);
  });

  test('есть оба токена и API валиден — авторизован', async () => {
    const mockUser = { id: '1', fullName: 'Тест', email: 'test@test.com', role: 'engineer' };

    (SecureStore.getItemAsync as jest.Mock)
      .mockResolvedValueOnce('access-123')
      .mockResolvedValueOnce('refresh-123');

    (mockedApi.get as jest.Mock).mockResolvedValue({ data: mockUser });

    await useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual(mockUser);
    expect(state.isLoading).toBe(false);
  });

  test('есть оба токена но API вернул 401 — нужен unlock', async () => {
    (SecureStore.getItemAsync as jest.Mock)
      .mockResolvedValueOnce('access-123')
      .mockResolvedValueOnce('refresh-123');

    (mockedApi.get as jest.Mock).mockRejectedValue(new Error('401'));

    await useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.needsUnlock).toBe(true);
    expect(state.isAuthenticated).toBe(false);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('accessToken');
  });

  test('есть только refreshToken — нужен unlock', async () => {
    (SecureStore.getItemAsync as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('refresh-123');

    await useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.needsUnlock).toBe(true);
    expect(state.isLoading).toBe(false);
  });
});

describe('authStore — unlock', () => {
  test('успешный refresh — авторизован', async () => {
    const mockUser = { id: '1', fullName: 'Тест', email: 'test@test.com', role: 'engineer' };

    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('refresh-123');
    (mockedApi.post as jest.Mock).mockResolvedValue({
      data: {
        user: mockUser,
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
      },
    });

    await useAuthStore.getState().unlock();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.accessToken).toBe('new-access');
    expect(state.user).toEqual(mockUser);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('accessToken', 'new-access');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('refreshToken', 'new-refresh');
  });

  test('refresh token истёк — полный сброс', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('expired-refresh');
    (mockedApi.post as jest.Mock).mockRejectedValue(new Error('401'));

    await useAuthStore.getState().unlock();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('refreshToken');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('accessToken');
  });

  test('нет refresh token — ошибка', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

    await useAuthStore.getState().unlock();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.needsUnlock).toBe(false);
  });
});
