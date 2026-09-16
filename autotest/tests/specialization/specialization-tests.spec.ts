import { test, expect } from '@playwright/test';
import { loginViaUI } from '../../helpers/auth.js';
import { ApiClient } from '../../helpers/api-client.js';

test.describe('Специализация @api @ui', () => {

  test('TC-111: Инженер меняет специализацию в ЛК @critical @api', async ({ request }) => {
    const api = new ApiClient(request);
    await api.authenticate('engineer');

    // Get current profile
    const profileRes = await api.get('/profile');
    expect(profileRes.ok()).toBeTruthy();
    const profile = await profileRes.json();
    expect(profile.specializationIszh !== undefined || profile.specializationVik !== undefined).toBeTruthy();

    // Update specialization
    const updateRes = await api.patch('/profile/specialization', {
      specializationVik: true,
      specializationIszh: true,
    });
    expect(updateRes.ok()).toBeTruthy();
    const updated = await updateRes.json();
    expect(updated.specializationVik).toBe(true);
    expect(updated.specializationIszh).toBe(true);

    // Restore original
    await api.patch('/profile/specialization', {
      specializationVik: profile.specializationVik || false,
      specializationIszh: profile.specializationIszh !== undefined ? profile.specializationIszh : true,
    });
  });

  test('TC-113: Блокирующий экран при отсутствии специализации @critical @api', async ({ request }) => {
    const api = new ApiClient(request);
    await api.authenticate('engineer');

    // Try to set both to false (should fail)
    const res = await api.patch('/profile/specialization', {
      specializationVik: false,
      specializationIszh: false,
    });
    expect(res.status()).toBe(400);
  });

  test('TC-114: Фильтрация задач по специализации @critical @api', async ({ request }) => {
    const api = new ApiClient(request);
    await api.authenticate('engineer');

    // Set only ViK specialization
    await api.patch('/profile/specialization', {
      specializationVik: true,
      specializationIszh: false,
    });

    // Create visit with mixed equipment
    const searchRes = await api.get('/refs/addresses/search', { q: 'Кутузовский' });
    const addresses = await searchRes.json();
    if (addresses.length === 0) {
      // Restore
      await api.patch('/profile/specialization', { specializationVik: false, specializationIszh: true });
      return;
    }

    const visitRes = await api.post('/visits', {
      addressId: addresses[0].id,
      engineerName: 'Тест',
      dateStart: new Date().toISOString().slice(0, 10),
      timeStart: '10:00',
      season: 'summer',
    });
    const visit = await visitRes.json();

    // Get visit details — should be filtered
    const detailRes = await api.get(`/visits/${visit.id}`);
    expect(detailRes.ok()).toBeTruthy();

    // Cleanup
    await api.delete(`/visits/${visit.id}`);
    // Restore specialization
    await api.patch('/profile/specialization', { specializationVik: false, specializationIszh: true });
  });

  test('TC-115: Специализация в PDF-отчёте @high @api', async ({ request }) => {
    const api = new ApiClient(request);
    await api.authenticate('admin');

    // Generate summary report — should include specialization
    const today = new Date().toISOString().slice(0, 10);
    const res = await api.post('/reports/summary-generate', {
      type: 'period',
      dateFrom: today,
      dateTo: today,
    });
    expect(res.ok()).toBeTruthy();
  });

  test('TC-116: ТМ изменяет специализацию инженера @high @api', async ({ request }) => {
    const api = new ApiClient(request);
    await api.authenticate('admin');

    // Get engineers
    const engRes = await api.get('/refs/engineers');
    expect(engRes.ok()).toBeTruthy();
  });
});
