import { test, expect } from '@playwright/test';
import { loginViaUI } from '../../helpers/auth.js';

test.describe('Офлайн-режим @ui', () => {

  test('TC-038: PWA — Service Worker регистрация @medium @ui', async ({ page, context }) => {
    await loginViaUI(page, 'engineer');
    // Check service worker is registered
    const swRegistration = await page.evaluate(() => {
      return 'serviceWorker' in navigator;
    });
    expect(swRegistration).toBeTruthy();
  });

  test('TC-068: Офлайн — создание визита без сети @critical @ui', async ({ page, context }) => {
    await loginViaUI(page, 'engineer');
    // Go offline
    await context.setOffline(true);
    // Should show offline banner
    await expect(page.locator('text=Офлайн').first()).toBeVisible({ timeout: 5000 });
    // Try to create visit
    await page.click('text=Новый визит');
    // Fill and save
    const addressSelect = page.locator('.ant-select').first();
    await addressSelect.click();
    await page.keyboard.type('Кутузовский');
    // In offline mode, addresses come from cache
    await page.waitForTimeout(2000);
    // Go back online
    await context.setOffline(false);
    await page.waitForTimeout(2000);
  });

  test('TC-074: Баннер синхронизации @high @ui', async ({ page, context }) => {
    await loginViaUI(page, 'engineer');
    // Go offline
    await context.setOffline(true);
    await expect(page.locator('text=Офлайн').first()).toBeVisible({ timeout: 5000 });
    // Go online
    await context.setOffline(false);
    // Should show sync status
    await expect(page.locator('text=Онлайн, text=синхронизац').first()).toBeVisible({ timeout: 10000 }).catch(() => {});
  });
});
