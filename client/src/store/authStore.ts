import { create } from 'zustand';
import { api } from '../api/client';
import { clearFingerprintCache } from '../utils/fingerprint';

interface User {
  id: string;
  fullName: string;
  email: string;
  role: 'engineer' | 'tm' | 'admin' | 'engineer_mtr' | 'tm_mtr';
  specializationVik?: boolean;
  specializationIszh?: boolean;
  specializationGpm?: boolean;
  specializationDgu?: boolean;
  specializationIbp?: boolean;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  updateSpecialization: (data: { specializationVik: boolean; specializationIszh: boolean; specializationGpm: boolean; specializationDgu: boolean; specializationIbp: boolean }) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const data = await api.login(normalizedEmail, password);
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    set({ user: data.user, isAuthenticated: true, isLoading: false });
  },

  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    clearFingerprintCache();
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      set({ isLoading: false, isAuthenticated: false });
      return;
    }
    try {
      const user = await api.me();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      set({ isLoading: false, isAuthenticated: false });
    }
  },

  updateSpecialization: async (data: { specializationVik: boolean; specializationIszh: boolean; specializationGpm: boolean; specializationDgu: boolean; specializationIbp: boolean }) => {
    const updated = await api.updateSpecialization(data);
    const currentUser = get().user;
    if (currentUser) {
      set({ user: { ...currentUser, specializationVik: data.specializationVik, specializationIszh: data.specializationIszh, specializationGpm: data.specializationGpm, specializationDgu: data.specializationDgu, specializationIbp: data.specializationIbp } });
    }
  },
}));
