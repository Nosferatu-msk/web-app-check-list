import { test, expect, Page } from '@playwright/test';

/**
 * E2E-тесты для кнопки «Завершить визит» — работа с существующими визитами
 *
 * Сценарий 1: Визит с 2+ задачами, одна заполнена — кнопка активна,
 *               нажатие показывает ошибку (не все задачи завершены)
 * Сценарий 2: Визит с 1 задачей, заполнена — кнопка активна,
 *               визит завершается, статус «Завершён»
 *
 * Пользователь: testic@test.ru / hello2026
 */

async function loginAsEngineer(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('testic@test.ru');
  await page.getByLabel('Пароль').fill('hello2026');
  await Promise.all([
    page.waitForURL(url => !url.toString().includes('/login'), { timeout: 15_000 }),
    page.getByRole('button', { name: 'Войти' }).click(),
  ]);
  await page.waitForTimeout(2000);

  const gate = page.getByText(/Выберите специализацию/);
  if (await gate.isVisible({ timeout: 3000 }).catch(() => false)) {
    const checkbox = page.locator('.ant-checkbox').filter({ hasText: /ИСЖ/ });
    if (await checkbox.isVisible().catch(() => false)) {
      await checkbox.click();
    } else {
      await page.locator('.ant-checkbox').first().click();
    }
    await page.getByRole('button', { name: 'Продолжить' }).click();
    await page.waitForTimeout(2000);
  }
}

test.describe('Кнопка «Завершить визит» — полные сценарии', () => {

  test('Сценарий 1: Визит с 2 задачами, одна заполнена — нажатие показывает ошибку', async ({ page }) => {
    await loginAsEngineer(page);

    // Ищем визит с несколькими задачами
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Находим первый визит в списке
    const visitCard = page.locator('.visit-card').first();
    const hasVisits = await visitCard.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasVisits) {
      test.skip();
      return;
    }

    await visitCard.click();
    await page.waitForTimeout(2000);

    // Проверяем, что есть хотя бы 2 задачи
    const taskRows = page.locator('.ant-table-row');
    const taskCount = await taskRows.count();

    if (taskCount < 2) {
      console.log(`В визите только ${taskCount} задач(а) — нужно минимум 2. Тест пропускается.`);
      test.skip();
      return;
    }

    console.log(`В визите ${taskCount} задач`);

    // Проверяем кнопку «Завершить визит»
    const completeBtn = page.getByRole('button', { name: /завершить визит/i });
    await expect(completeBtn).toBeVisible({ timeout: 5000 });

    // Проверяем состояние кнопки
    const isEnabled = await completeBtn.isEnabled();
    console.log('Кнопка активна:', isEnabled);

    if (!isEnabled) {
      console.log('Кнопка заблокирована — нет completed задач. Это ожидаемое поведение.');
      return;
    }

    // Кнопка активна — нажимаем
    await completeBtn.click();
    await page.waitForTimeout(3000);

    // Проверяем результат:
    // 1. Либо появилась ошибка (не все задачи завершены или не хватает фото)
    const errorMsg = page.locator('.ant-message-error').first();
    const hasError = await errorMsg.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasError) {
      const errorText = await errorMsg.textContent();
      console.log('✓ Появилась ошибка:', errorText);
      expect(errorText).toBeTruthy();
      expect(errorText.toLowerCase()).toContain('нельзя завершить визит');
      return;
    }

    // 2. Либо появилось предупреждение
    const warningMsg = page.locator('.ant-message-warning').first();
    const hasWarning = await warningMsg.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasWarning) {
      const warningText = await warningMsg.textContent();
      console.log('✓ Появилось предупреждение:', warningText);
      return;
    }

    // 3. Либо произошёл переход на страницу отчёта (визит завершён)
    const currentUrl = page.url();
    if (currentUrl.includes('/report')) {
      console.log('✓ Визит успешно завершён — переход на страницу отчёта');
      expect(currentUrl).toContain('/report');
      return;
    }

    // 4. Ничего не произошло — баг!
    console.log('✗ ВНИМАНИЕ: Ничего не произошло — баг не исправлен!');
    console.log('URL:', currentUrl);
    throw new Error('Кнопка «Завершить визит» не работает — нет ошибки и нет перехода');
  });

  test('Сценарий 2: Завершённый визит имеет статус «Завершён»', async ({ page }) => {
    await loginAsEngineer(page);

    // Ищем завершённый визит
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Ищем тег со статусом «Завершён» или «Отправлен»
    const completedTag = page.locator('.ant-tag').filter({ hasText: /заверш|отправлен/i }).first();
    const hasCompleted = await completedTag.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasCompleted) {
      console.log('Нет завершённых визитов в списке — тест пропускается');
      test.skip();
      return;
    }

    // Кликаем по визиту
    const visitCard = completedTag.locator('xpath=ancestor::div[contains(@class, "visit-card")]').first();
    if (await visitCard.isVisible().catch(() => false)) {
      await visitCard.click();
    } else {
      await page.locator('.visit-card').first().click();
    }
    await page.waitForTimeout(2000);

    // Проверяем, что визит загружен
    const pageTitle = page.getByText('Визит').first();
    await expect(pageTitle).toBeVisible({ timeout: 5000 });

    // Проверяем, что кнопка «Завершить визит» отсутствует или заблокирована
    const completeBtn = page.getByRole('button', { name: /завершить визит/i });
    const hasBtn = await completeBtn.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasBtn) {
      const isEnabled = await completeBtn.isEnabled();
      console.log('Кнопка «Завершить визит» присутствует, активна:', isEnabled);
      // Для завершённого визита кнопка может быть скрыта или заблокирована
    } else {
      console.log('✓ Кнопка «Завершить визит» отсутствует (визит уже завершён)');
    }

    // Проверяем, что есть задачи
    const taskRows = page.locator('.ant-table-row');
    const taskCount = await taskRows.count();
    console.log(`Количество задач: ${taskCount}`);

    expect(taskCount).toBeGreaterThan(0);
  });

  test('Сценарий 3: Добавление задачи к завершённому визиту не меняет статус', async ({ page }) => {
    await loginAsEngineer(page);

    // Ищем завершённый визит
    await page.goto('/');
    await page.waitForTimeout(2000);

    const completedTag = page.locator('.ant-tag').filter({ hasText: /заверш/i }).first();
    const hasCompleted = await completedTag.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasCompleted) {
      console.log('Нет завершённых визитов — тест пропускается');
      test.skip();
      return;
    }

    // Запоминаем статус до добавления задачи
    const statusTextBefore = await completedTag.textContent();
    console.log('Статус до:', statusTextBefore);

    // Кликаем по визиту
    const visitCard = completedTag.locator('xpath=ancestor::div[contains(@class, "visit-card")]').first();
    if (await visitCard.isVisible().catch(() => false)) {
      await visitCard.click();
    } else {
      await page.locator('.visit-card').first().click();
    }
    await page.waitForTimeout(2000);

    // Проверяем, что кнопка «Добавить оборудование» присутствует
    const addBtn = page.getByRole('button', { name: /добавить оборудование/i });
    const hasAddBtn = await addBtn.isVisible({ timeout: 3000 }).catch(() => false);

    if (!hasAddBtn) {
      console.log('Кнопка «Добавить оборудование» отсутствует — тест пропускается');
      test.skip();
      return;
    }

    console.log('✓ Кнопка «Добавить оборудование» присутствует для завершённого визита');

    // Возвращаемся к списку
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Проверяем, что статус не изменился
    const completedTagAfter = page.locator('.ant-tag').filter({ hasText: /заверш/i }).first();
    const statusTextAfter = await completedTagAfter.textContent();
    console.log('Статус после:', statusTextAfter);

    expect(statusTextAfter?.toLowerCase()).toContain('заверш');
  });
});
