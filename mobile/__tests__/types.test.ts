import type { Visit, VisitStatus, Task, TaskStatus, Conclusion, Photo } from '../src/types';

describe('Типы данных', () => {
  test('VisitStatus — все допустимые значения', () => {
    const statuses: VisitStatus[] = [
      'planned', 'not_started', 'in_progress', 'completed',
      'sent', 'sent_by_engineer', 'sent_by_tm', 'corrected_by_tm',
      'awaiting_assignment',
    ];
    expect(statuses).toHaveLength(9);
  });

  test('TaskStatus — все допустимые значения', () => {
    const statuses: TaskStatus[] = ['not_started', 'in_progress', 'completed'];
    expect(statuses).toHaveLength(3);
  });

  test('Conclusion — все допустимые значения', () => {
    const conclusions: Conclusion[] = [
      'Исправно, замечаний нет',
      'Исправно, есть замечания',
      'Неисправно',
    ];
    expect(conclusions).toHaveLength(3);
  });

  test('Visit — минимальный объект', () => {
    const visit: Visit = {
      id: 'v1',
      address_id: 'a1',
      address: 'г. Москва, ул. Тестовая, д. 1',
      date: '2026-09-01',
      time_start: '10:00',
      season: 'summer',
      status: 'not_started',
    };
    expect(visit.season).toBe('summer');
    expect(visit.tasks).toBeUndefined();
  });

  test('Task — с параметрами и фото', () => {
    const task: Task = {
      id: 't1',
      visit_id: 'v1',
      equipment_type_id: 'eq1',
      equipment_type_code: 'rsch',
      room_type_id: 'r1',
      room_type_code: 'server_room',
      task_type: 'individual',
      status: 'completed',
      parameters: { voltage: 220, frequency: 50 },
      conclusion: 'Исправно, замечаний нет',
      photos_count: 1,
    };
    expect(task.conclusion).toBe('Исправно, замечаний нет');
    expect(task.parameters).toHaveProperty('voltage', 220);
  });

  test('Photo — before/after моменты', () => {
    const before: Photo = {
      id: 'p1', task_id: 't1', moment: 'before',
      file_path: '/photos/01_rsch_server_before.jpg',
      file_name: '01_rsch_server_before.jpg',
      uploaded: false,
    };
    const after: Photo = {
      id: 'p2', task_id: 't1', moment: 'after',
      file_path: '/photos/01_rsch_server_after.jpg',
      file_name: '01_rsch_server_after.jpg',
      uploaded: true,
      server_id: 's1',
    };
    expect(before.moment).toBe('before');
    expect(after.uploaded).toBe(true);
    expect(after.server_id).toBe('s1');
  });

  test('season — только summer/winter', () => {
    const summer: Visit['season'] = 'summer';
    const winter: Visit['season'] = 'winter';
    expect(summer).not.toBe(winter);
  });
});
