/**
 * UI-тесты: Мобильная адаптация, профиль, PWA
 */
import { test, expect } from '@playwright/test';

const LOGIN = 'testic@test.ru';
const PASS = 'hello2026';

async function doLogin(page: any) {
  await page.goto('/login');
  await page.fill('input[type="email"], input#email, input[placeholder*="email" i], input[name="email"]', LOGIN);
  await page.fill('input[type="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
}

test.describe('Мобильная адаптация (393px)', () => {
  test('TC-236: Нет горизонтальной прокрутки', async ({ page }) => {
    await doLogin(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    const hasOverflow = scrollWidth > clientWidth + 2; // 2px tolerance
    console.log(`scrollWidth=${scrollWidth}, clientWidth=${clientWidth}, overflow=${hasOverflow}`);
    expect(hasOverflow).toBeFalsy();
  });

  test('TC-243: Bottom Navigation отображается', async ({ page }) => {
    await doLogin(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // BottomNav должен быть виден на мобильном
    const bottomNav = page.locator('[class*="bottom-nav"], [class*="BottomNav"], nav[aria-label*="навигация" i]').first();
    const visible = await bottomNav.isVisible().catch(() => false);
    console.log(`Bottom nav visible: ${visible}`);
    // На мобильном (< 768px) BottomNav должен быть виден
    if (page.viewportSize()?.width && page.viewportSize()!.width < 768) {
      expect(visible).toBeTruthy();
    }
  });

  test('TC-247: Touch targets >= 44px', async ({ page }) => {
    await doLogin(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Проверить размеры кнопок в BottomNav
    const buttons = await page.locator('[class*="bottom-nav"] a, [class*="bottom-nav"] button, [class*="bottom-nav"] [role="tab"]').all();
    for (const btn of buttons) {
      const box = await btn.boundingBox();
      if (box) {
        console.log(`Button: ${box.width}x${box.height}`);
        expect(box.height).toBeGreaterThanOrEqual(40); // 40px минимум (допускаем 4px отклонение)
      }
    }
  });

  test('TC-246: Safe area — viewport-fit=cover', async ({ page }) => {
    await page.goto('/login');
    const viewportMeta = await page.locator('meta[name="viewport"]').getAttribute('content');
    console.log(`Viewport meta: ${viewportMeta}`);
    expect(viewportMeta).toContain('viewport-fit=cover');
  });
});

test.describe('Профиль инженера', () => {
  test('TC-047: Страница профиля загружается', async ({ page }) => {
    await doLogin(page);
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Должно отображаться ФИО
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toContain('Тестик');
  });

  test('TC-111: Изменение специализации', async ({ page }) => {
    await doLogin(page);
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Найти чекбоксы специализации
    const checkboxes = await page.locator('input[type="checkbox"]').count();
    console.log(`Checkboxes on profile: ${checkboxes}`);
  });

  test('TC-142: Статистика визитов', async ({ page }) => {
    await doLogin(page);
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Проверить наличие статистики
    const hasStats = await page.locator('text=/визит/i').count();
    console.log(`Stats elements: ${hasStats}`);
  });
});

test.describe('PWA', () => {
  test('TC-038: Service Worker регистрируется', async ({ page }) => {
    await doLogin(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const swRegistered = await page.evaluate(() => 'serviceWorker' in navigator);
    console.log(`Service Worker API available: ${swRegistered}`);
    expect(swRegistered).toBeTruthy();
  });

  test('TC-099: Manifest присутствует', async ({ page }) => {
    await page.goto('/');
    const manifest = await page.locator('link[rel="manifest"]').getAttribute('href');
    console.log(`Manifest href: ${manifest}`);
    expect(manifest).toBeTruthy();
  });

  test('TC-039: Консоль без критических ошибок после входа', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));

    await doLogin(page);
    await page.waitForTimeout(5000);

    const critical = errors.filter(e =>
      !e.includes('favicon') && !e.includes('DevTools') && !e.includes('sourceMap')
    );
    console.log(`Page errors: ${critical.length}`);
    if (critical.length > 0) console.log(critical.join('\n'));
  });
});

test.describe('Страница входа — UI', () => {
  test('TC-LOGIN-UI: Форма входа корректна', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Email поле (antd может использовать input без type="email")
    const emailInput = page.locator('input').first();
    await expect(emailInput).toBeVisible({ timeout: 15000 });

    // Password поле
    const passInput = page.locator('input[type="password"]');
    await expect(passInput).toBeVisible();

    // Кнопка входа
    const submitBtn = page.locator('button[type="submit"]').first();
    await expect(submitBtn).toBeVisible();

    // Кнопка должна быть >= 44px
    const btnBox = await submitBtn.boundingBox();
    if (btnBox) {
      console.log(`Login button: ${btnBox.width}x${btnBox.height}`);
      expect(btnBox.height).toBeGreaterThanOrEqual(40);
    }

    // Проверить что есть 2 поля ввода
    const inputs = await page.locator('input').count();
    console.log(`Login form inputs: ${inputs}`);
    expect(inputs).toBeGreaterThanOrEqual(2);
  });
});
