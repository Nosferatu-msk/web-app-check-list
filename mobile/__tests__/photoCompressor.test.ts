import { generateFileName, formatFileSize } from '../src/utils/photoCompressor';

describe('generateFileName', () => {
  test('формат по шаблону {№}_{equipment}_{room}_{moment}.jpg', () => {
    expect(generateFileName(1, 'rsch', 'serverroom', 'before'))
      .toBe('01_rsch_serverroom_before.jpg');
  });

  test('дополняет номер нулями до 2 знаков', () => {
    expect(generateFileName(3, 'vent', 'clienthall', 'after'))
      .toBe('03_vent_clienthall_after.jpg');
  });

  test('двузначный номер не дополняется', () => {
    expect(generateFileName(15, 'splitvn', 'foodroom', 'before'))
      .toBe('15_splitvn_foodroom_before.jpg');
  });

  test('приводит код к нижнему регистру', () => {
    expect(generateFileName(1, 'RSCH', 'SERVER', 'before'))
      .toBe('01_rsch_server_before.jpg');
  });

  test('удаляет спецсимволы из кодов (включая _ и -)', () => {
    expect(generateFileName(1, 'schetchik_gvs', 'heat-unit', 'before'))
      .toBe('01_schetchikgvs_heatunit_before.jpg');
  });

  test('все 13 типов оборудования корректно', () => {
    const codes = [
      'rsch', 'vent', 'vrv_vn', 'mssvn', 'splitvn',
      'vrv_nar', 'mssnar', 'splitnar',
      'schetchik_gvs', 'schetchik_hvs', 'schetchik_electroshc',
      'seti_vodosnab', 'teplovye_seti',
    ];
    for (const code of codes) {
      const name = generateFileName(1, code, 'room', 'before');
      expect(name).toMatch(/^\d{2}_[a-z0-9]+_room_before\.jpg$/);
    }
  });
});

describe('formatFileSize', () => {
  test('байты < 1024', () => {
    expect(formatFileSize(0)).toBe('0 Б');
    expect(formatFileSize(512)).toBe('512 Б');
    expect(formatFileSize(1023)).toBe('1023 Б');
  });

  test('килобайты', () => {
    expect(formatFileSize(1024)).toBe('1.0 КБ');
    expect(formatFileSize(1536)).toBe('1.5 КБ');
    expect(formatFileSize(1024 * 100)).toBe('100.0 КБ');
  });

  test('мегабайты', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1.0 МБ');
    expect(formatFileSize(1024 * 1024 * 5.5)).toBe('5.5 МБ');
  });

  test('граничные значения', () => {
    expect(formatFileSize(1023)).toBe('1023 Б');
    expect(formatFileSize(1024)).toBe('1.0 КБ');
    expect(formatFileSize(1024 * 1024 - 1)).toBe('1024.0 КБ');
    expect(formatFileSize(1024 * 1024)).toBe('1.0 МБ');
  });
});
