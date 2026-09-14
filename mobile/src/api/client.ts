import axios from 'axios';

// TODO: Заменить на production URL
const BASE_URL = 'http://10.0.2.2:3001/api'; // Android emulator
// const BASE_URL = 'http://localhost:3001/api'; // iOS simulator
// const BASE_URL = 'https://your-domain.com/api'; // Production

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor: добавление Authorization header
api.interceptors.request.use(async (config) => {
  // TODO: Получить токен из Secure Store
  // const token = await SecureStore.getItemAsync('accessToken');
  // if (token) {
  //   config.headers.Authorization = `Bearer ${token}`;
  // }
  return config;
});

// Interceptor: обработка 401 (refresh token)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // TODO: Попытаться обновить токен
      // const refreshToken = await SecureStore.getItemAsync('refreshToken');
      // if (refreshToken) {
      //   try {
      //     const response = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
      //     const { accessToken } = response.data;
      //     await SecureStore.setItemAsync('accessToken', accessToken);
      //     error.config.headers.Authorization = `Bearer ${accessToken}`;
      //     return api(error.config);
      //   } catch (refreshError) {
      //     // Refresh failed, logout
      //     useAuthStore.getState().logout();
      //   }
      // }
    }
    return Promise.reject(error);
  }
);
