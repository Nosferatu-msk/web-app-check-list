import dotenv from 'dotenv';
dotenv.config();

export interface TestConfig {
  baseURL: string;
  apiURL: string;
  credentials: {
    admin: { email: string; password: string };
    tm: { email: string; password: string };
    engineer: { email: string; password: string };
  };
  timeouts: {
    navigation: number;
    api: number;
    upload: number;
  };
}

export const config: TestConfig = {
  baseURL: process.env.TEST_BASE_URL || 'https://checkonout.ru',
  apiURL: process.env.TEST_API_URL || 'https://checkonout.ru/api',
  credentials: {
    admin: {
      email: process.env.TEST_ADMIN_EMAIL || 'admin@example.com',
      password: process.env.TEST_ADMIN_PASSWORD || 'admin123',
    },
    tm: {
      email: process.env.TEST_TM_EMAIL || 'tm@example.com',
      password: process.env.TEST_TM_PASSWORD || '123456',
    },
    engineer: {
      email: process.env.TEST_ENGINEER_EMAIL || 'testic@test.ru',
      password: process.env.TEST_ENGINEER_PASSWORD || '123456',
    },
  },
  timeouts: {
    navigation: 30000,
    api: 15000,
    upload: 60000,
  },
};
