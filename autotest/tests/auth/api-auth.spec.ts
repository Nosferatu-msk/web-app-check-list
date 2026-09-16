import { test, expect } from '@playwright/test';
import { config } from '../../config/test-config.js';

test.describe('Авторизация API @api', () => {

  test('TC-001: API вход инженера @critical @api', async ({ request }) => {
    const response = await request.post(`${config.apiURL}/auth/login`, {
      data: { email: config.credentials.engineer.email, password: config.credentials.engineer.password },
    });
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.accessToken).toBeTruthy();
    expect(data.user.role).toBe('engineer');
  });

  test('TC-003: API неверный пароль @high @api', async ({ request }) => {
    const response = await request.post(`${config.apiURL}/auth/login`, {
      data: { email: config.credentials.engineer.email, password: 'wrongpassword' },
    });
    expect(response.status()).toBe(401);
  });
});
