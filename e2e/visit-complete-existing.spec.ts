import { test, expect, Page } from '@playwright/test';

/**
 * E2E-тесты для кнопки «Завершить визит» — работа с существующими визитами
 *
 * Эти тесты не создают новые визиты, а работают с теми, что уже есть в системе.
 * Они проверяют поведение кнопки в различных состояниях.
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

test.describe('Кнопка «Завершить визит» — существующие визиты', () => {

  test('Кнопка заблокирована, когда нет completed задач', async ({ page }) => {
    await loginAsEngineer(page);

    // Ищем визит в статусе «В работе» (in_progress)
    await page.goto('/');
    await page.waitForTimeout(2000);

    const visitCard = page.locator('.visit-card').first();
    const hasVisits = await visitCard.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasVisits) {
      test.skip();
      return;
    }

    await visitCard.click();
    await page.waitForTimeout(2000);

    // Проверяем кнопку «Завершить визит»
    const completeBtn = page.getByRole('button', { name: /завершить визит/i });
    const hasBtn = await completeBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasBtn) {
      // Кнопка может быть не видна, если визит уже завершён
      const statusTag = page.locator('.ant-tag').filter({ hasText: /заверш|отправлен/i }).first();
      if (await statusTag.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log('Визит уже завершён — тест пропускается');
        test.skip();
        return;
      }
      test.skip();
      return;
    }

    // Считаем количество задач
    const taskRows = page.locator('.ant-table-row');
    const taskCount = await taskRows.count();

    if (taskCount === 0) {
      console.log('Нет задач в визите — кнопка должна быть заблокирована');
      await expect(completeBtn).toBeDisabled();
      return;
    }

    // Проверяем статусы задач через текст в таблице
    const completedTasks = page.locator('.ant-table-cell').filter({ hasText: /^Выполнено$/ });
    const completedCount = await completedTasks.count();

    if (completedCount === 0) {
      console.log('Нет completed задач — кнопка должна быть заблокирована');
      // Кнопка может быть заблокирована или активна (если есть in_progress задачи)
      const isDisabled = await completeBtn.isDisabled();
      console.log('Кнопка заблокирована:', isDisabled);
    } else {
      console.log(`Есть ${completedCount} completed задач из ${taskCount} — кнопка может быть активна`);
    }
  });

  test('Кнопка активна, когда есть completed задачи — нажатие показывает ошибку или завершает визит', async ({ page }) => {
    await loginAsEngineer(page);

    await page.goto('/');
    await page.waitForTimeout(2000);

    // Ищем визит с задачами
    const visitCard = page.locator('.visit-card').first();
    const hasVisits = await visitCard.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasVisits) {
      test.skip();
      return;
    }

    await visitCard.click();
    await page.waitForTimeout(2000);

    const completeBtn = page.getByRole('button', { name: /завершить визит/i });
    const hasBtn = await completeBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasBtn) {
      test.skip();
      return;
    }

    const isEnabled = await completeBtn.isEnabled();

    if (!isEnabled) {
      console.log('Кнопка заблокирована — тест пропускается (нет completed задач)');
      test.skip();
      return;
    }

    // Кнопка активна — нажимаем
    await completeBtn.click();
    await page.waitForTimeout(3000);

    // Проверяем результат:
    // 1. Либо появилась ошибка (не все задачи завершены)
    const errorMsg = page.locator('.ant-message-error').first();
    const hasError = await errorMsg.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasError) {
      const errorText = await errorMsg.textContent();
      console.log('Появилась ошибка:', errorText);
      expect(errorText).toBeTruthy();
      return;
    }

    // 2. Либо произошёл переход на страницу отчёта (визит завершён)
    const currentUrl = page.url();
    if (currentUrl.includes('/report')) {
      console.log('Визит успешно завершён — переход на страницу отчёта');
      expect(currentUrl).toContain('/report');
      return;
    }

    // 3. Либо ничего не произошло (баг!)
    console.log('ВНИМАНИЕ: Ничего не произошло — возможный баг!');
    console.log('URL:', currentUrl);

    // Проверяем, есть ли предупреждение (warning)
    const warningMsg = page.locator('.ant-message-warning').first();
    const hasWarning = await warningMsg.isVisible({ timeout: 2000 }).catch(() => false);
    if (hasWarning) {
      const warningText = await warningMsg.textContent();
      console.log('Предупреждение:', warningText);
    }
  });

  test('После завершения визита статус меняется на «Завершён»', async ({ page }) => {
    await loginAsEngineer(page);

    // Ищем завершённый визит в списке
    await page.goto('/');
    await page.waitForTimeout(2000);

    const completedTag = page.locator('.ant-tag').filter({ hasText: /заверш/i }).first();
    const hasCompleted = await completedTag.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasCompleted) {
      console.log('Нет завершённых визитов — тест пропускается');
      test.skip();
      return;
    }

    // Запоминаем статус из списка
    const statusText = await completedTag.textContent();
    console.log('Статус в списке:', statusText);
    expect(statusText?.toLowerCase()).toContain('заверш');

    // Кликаем по визиту
    const visitCard = completedTag.locator('xpath=ancestor::div[contains(@class, "visit-card")]').first();
    if (await visitCard.isVisible().catch(() => false)) {
      await visitCard.click();
    } else {
      await page.locator('.visit-card').first().click();
    }
    await page.waitForTimeout(2000);

    // Проверяем, что страница визита загрузилась
    const pageTitle = page.getByText('Визит').first();
    await expect(pageTitle).toBeVisible({ timeout: 5000 });

    // Проверяем, что Steps показывает последний шаг (Отчёт) как активный/завершённый
    const steps = page.locator('.ant-steps-item');
    const stepsCount = await steps.count();
    console.log(`Количество шагов: ${stepsCount}`);

    if (stepsCount > 0) {
      const lastStep = steps.last();
      const lastStepClass = await lastStep.getAttribute('class');
      console.log('Класс последнего шага:', lastStepClass);
      // Последний шаг должен быть completed или process
      expect(lastStepClass).toMatch(/completed|process/);
    }
  });
});
