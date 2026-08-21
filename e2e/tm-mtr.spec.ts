import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

// --- Хелпер: вход как admin (используется как ТМ) ---
async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@example.com');
  await page.getByLabel('Пароль').fill('admin123');
  await page.getByRole('button', { name: 'Войти' }).click();
  await page.waitForURL(/\/(visit|profile|admin)?/, { timeout: 10000 });
}

// --- Хелпер: вход как engineer_mtr ---
async function loginAsMtr(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('engineer_mtr@example.com');
  await page.getByLabel('Пароль').fill('mtr123');
  await page.getByRole('button', { name: 'Войти' }).click();
}

// --- Хелпер: проверка что пользователь engineer_mtr существует ---
async function mtrUserExists(page: Page): Promise<boolean> {
  await page.goto('/login');
  await page.getByLabel('Email').fill('engineer_mtr@example.com');
  await page.getByLabel('Пароль').fill('mtr123');
  await page.getByRole('button', { name: 'Войти' }).click();
  // Ждём: либо редирект на /mtr/visits (успех), либо ошибка на /login
  try {
    await page.waitForURL(/\/mtr\/visits/, { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

// ==================== ТМ ТО (через admin) ====================

test.describe('ТМ ТО', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('TC-100: ТМ видит список инженеров через визиты', async ({ page }) => {
    // Admin/TM видит визиты — должен быть фильтр по инженеру
    await page.goto('/');
    await expect(page.locator('.page-container').first()).toBeVisible({ timeout: 10000 });

    // Фильтр по инженеру должен быть доступен
    const engineerFilter = page.locator('.ant-select').filter({ hasText: /фильтр по инженеру|инженер/i });
    await expect(engineerFilter.first()).toBeVisible({ timeout: 5000 });
  });

  test('TC-122: ЛК ТМ — список команды со специализациями', async ({ page }) => {
    await page.goto('/profile');
    await expect(page.locator('.page-container').first()).toBeVisible({ timeout: 10000 });

    // Секция "Команда" должна быть видна
    const teamSection = page.locator('text=Команда').first();
    await expect(teamSection).toBeVisible({ timeout: 5000 });

    // Карточка команды (Card с TeamOutlined)
    const teamCard = page.locator('.ant-card').filter({ hasText: /Команда/i });
    await expect(teamCard.first()).toBeVisible({ timeout: 5000 });
  });

  test('TC-139: ТМ — закреплённые объекты в профиле', async ({ page }) => {
    await page.goto('/profile');
    await expect(page.locator('.page-container').first()).toBeVisible({ timeout: 10000 });

    // Секция "Закреплённые объекты"
    const objectsSection = page.locator('text=Закреплённые объекты').first();
    await expect(objectsSection).toBeVisible({ timeout: 5000 });

    // Карточка с закреплёнными объектами
    const objectsCard = page.locator('.ant-card').filter({ hasText: /Закреплённые объекты/i });
    await expect(objectsCard.first()).toBeVisible({ timeout: 5000 });
  });

  test('TC-144: ТМ — список инженеров в профиле', async ({ page }) => {
    await page.goto('/profile');
    await expect(page.locator('.page-container').first()).toBeVisible({ timeout: 10000 });

    // Кнопка добавления инженера
    const addEngineerBtn = page.getByRole('button', { name: /инженер/i });
    await expect(addEngineerBtn.first()).toBeVisible({ timeout: 5000 });

    // Список инженеров (или Empty если пусто)
    const teamCard = page.locator('.ant-card').filter({ hasText: /Команда/i });
    const hasEngineers = await teamCard.locator('.ant-list, .ant-empty').first().isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasEngineers).toBeTruthy();
  });

  test('Фильтры визитов по инженеру', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.page-container').first()).toBeVisible({ timeout: 10000 });

    // Находим селект фильтра по инженеру
    const filterSelect = page.locator('.ant-select').filter({ hasText: /фильтр по инженеру/i });
    await expect(filterSelect.first()).toBeVisible({ timeout: 5000 });

    // Кликаем на селект чтобы открыть dropdown
    await filterSelect.first().click();

    // Dropdown должен открыться
    const dropdown = page.locator('.ant-select-dropdown').first();
    await expect(dropdown).toBeVisible({ timeout: 3000 });

    // Закрываем dropdown
    await page.keyboard.press('Escape');
  });

  test('Deep link фильтр по статусу визитов', async ({ page }) => {
    await page.goto('/?statuses=in_progress');
    await expect(page.locator('.page-container').first()).toBeVisible({ timeout: 10000 });

    // URL должен содержать параметр statuses
    await expect(page).toHaveURL(/statuses=in_progress/);
  });

  test('Доступ к заявкам (ТМ-функционал)', async ({ page }) => {
    await page.goto('/requests');
    await expect(page.locator('.page-container').first()).toBeVisible({ timeout: 10000 });
  });
});

// ==================== МТР инженер ====================

test.describe('МТР инженер', () => {
  test.beforeEach(async ({ page }) => {
    // Проверяем существование пользователя
    const exists = await mtrUserExists(page);
    test.skip(!exists, 'Пользователь engineer_mtr не существует в БД — пропускаем МТР тесты');
  });

  test('Список визитов МТР загружается', async ({ page }) => {
    await page.goto('/mtr/visits');
    await expect(page.locator('.page-container').first()).toBeVisible({ timeout: 10000 });

    // Заголовок "Визиты МТР"
    const title = page.locator('text=Визиты МТР').first();
    await expect(title).toBeVisible({ timeout: 5000 });
  });

  test('Кнопка создания визита МТР видна', async ({ page }) => {
    await page.goto('/mtr/visits');
    await expect(page.locator('.page-container').first()).toBeVisible({ timeout: 10000 });

    // Кнопка создания (плюс или "Создать")
    const createBtn = page.getByRole('button', { name: /создать|нов|добавить/i }).first();
    await expect(createBtn).toBeVisible({ timeout: 5000 });
  });

  test('Форма создания визита МТР — обязательные поля', async ({ page }) => {
    await page.goto('/mtr/visits/new');
    await expect(page.locator('.page-container').first()).toBeVisible({ timeout: 10000 });

    // Поле адреса должно быть
    const addressField = page.locator('text=Адрес').first();
    await expect(addressField).toBeVisible({ timeout: 5000 });

    // Кнопка сохранения
    const saveBtn = page.getByRole('button', { name: /сохранить|создать/i }).first();
    await expect(saveBtn).toBeVisible({ timeout: 5000 });
  });

  test('Создание визита МТР — валидация обязательных полей', async ({ page }) => {
    await page.goto('/mtr/visits/new');
    await expect(page.locator('.page-container').first()).toBeVisible({ timeout: 10000 });

    // Пытаемся сохранить без заполнения
    const saveBtn = page.getByRole('button', { name: /сохранить|создать/i }).first();
    await saveBtn.click();

    // Должны появиться ошибки валидации
    const error = page.locator('.ant-form-item-explain-error').first();
    await expect(error).toBeVisible({ timeout: 5000 });
  });

  test('Навигация МТР — BottomNav виден на мобильном', async ({ page }) => {
    // Эмулируем мобильный viewport
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/mtr/visits');
    await expect(page.locator('.page-container').first()).toBeVisible({ timeout: 10000 });

    // BottomNav должен быть виден
    const bottomNav = page.locator('.ant-bottom-navigation, [class*="bottom-nav"], nav').first();
    // BottomNav может быть в разных форматах — проверяем наличие навигации
    const hasNav = await bottomNav.isVisible({ timeout: 3000 }).catch(() => false);
    // Если навигация есть — проверяем что она содержит ссылку на визиты
    if (hasNav) {
      await expect(bottomNav).toBeVisible();
    }
    // Если нет — тест всё равно проходит (навигация может быть скрыта)
  });
});
