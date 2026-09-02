import { getEquipmentIcon } from '../src/utils/equipmentIcons';
import { getRoomIcon } from '../src/utils/roomIcons';

describe('equipmentIcons', () => {
  test('возвращает electric-switch для rsch (РЩ/ГРЩ)', () => {
    expect(getEquipmentIcon('rsch')).toBe('electric-switch');
  });

  test('возвращает fan для vent (Вентиляция)', () => {
    expect(getEquipmentIcon('vent')).toBe('fan');
  });

  test('возвращает snowflake для внутренних блоков', () => {
    expect(getEquipmentIcon('splitvn')).toBe('snowflake');
    expect(getEquipmentIcon('mssvn')).toBe('snowflake');
    expect(getEquipmentIcon('vrv_vn')).toBe('snowflake');
  });

  test('возвращает air-conditioner для наружных блоков', () => {
    expect(getEquipmentIcon('splitnar')).toBe('air-conditioner');
    expect(getEquipmentIcon('mssnar')).toBe('air-conditioner');
    expect(getEquipmentIcon('vrv_nar')).toBe('air-conditioner');
  });

  test('возвращает gauge для счётчиков воды', () => {
    expect(getEquipmentIcon('schetchik_gvs')).toBe('gauge');
    expect(getEquipmentIcon('schetchik_hvs')).toBe('gauge');
  });

  test('возвращает meter-electric для счётчика электроэнергии', () => {
    expect(getEquipmentIcon('schetchik_electroshc')).toBe('meter-electric');
  });

  test('возвращает water для водоснабжения', () => {
    expect(getEquipmentIcon('seti_vodosnab')).toBe('water');
  });

  test('возвращает thermometer для тепловых сетей', () => {
    expect(getEquipmentIcon('teplovye_seti')).toBe('thermometer');
  });

  test('возвращает default иконку для неизвестного типа', () => {
    expect(getEquipmentIcon('unknown')).toBe('electric-switch');
  });
});

describe('roomIcons', () => {
  test('возвращает lightning-bolt для электрощитовой', () => {
    expect(getRoomIcon('electric_room')).toBe('lightning-bolt');
  });

  test('возвращает server для серверной', () => {
    expect(getRoomIcon('server_room')).toBe('server');
  });

  test('возвращает account-group для клиентского зала', () => {
    expect(getRoomIcon('client_hall')).toBe('account-group');
  });

  test('возвращает silverware-fork-knife для комнаты приёма пищи', () => {
    expect(getRoomIcon('food_room')).toBe('silverware-fork-knife');
  });

  test('возвращает toilet для санузла', () => {
    expect(getRoomIcon('bathroom')).toBe('toilet');
  });

  test('возвращает home-roof для кровли', () => {
    expect(getRoomIcon('roof')).toBe('home-roof');
  });

  test('возвращает office-building для фасада', () => {
    expect(getRoomIcon('facade')).toBe('office-building');
  });

  test('возвращает kiosk для зоны самообслуживания', () => {
    expect(getRoomIcon('self_service')).toBe('kiosk');
  });

  test('возвращает door для крыльца', () => {
    expect(getRoomIcon('porch')).toBe('door');
  });

  test('возвращает radiator для теплового узла', () => {
    expect(getRoomIcon('heat_unit')).toBe('radiator');
  });

  test('возвращает cash для кассы', () => {
    expect(getRoomIcon('cashbox')).toBe('cash');
  });

  test('возвращает package-variant для КХЦ', () => {
    expect(getRoomIcon('khc')).toBe('package-variant');
  });

  test('возвращает default иконку для неизвестного типа', () => {
    expect(getRoomIcon('unknown')).toBe('office-building');
  });
});
