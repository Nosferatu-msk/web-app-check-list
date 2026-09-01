export type EquipmentIconName =
  | 'electric-switch'
  | 'fan'
  | 'snowflake'
  | 'air-conditioner'
  | 'gauge'
  | 'meter-electric'
  | 'water'
  | 'thermometer';

const EQUIPMENT_ICONS: Record<string, EquipmentIconName> = {
  rsch: 'electric-switch',
  vent: 'fan',
  vrv_vn: 'snowflake',
  mssvn: 'snowflake',
  splitvn: 'snowflake',
  vrv_nar: 'air-conditioner',
  mssnar: 'air-conditioner',
  splitnar: 'air-conditioner',
  schetchik_gvs: 'gauge',
  schetchik_hvs: 'gauge',
  schetchik_electroshc: 'meter-electric',
  seti_vodosnab: 'water',
  teplovye_seti: 'thermometer',
};

export function getEquipmentIcon(code?: string): EquipmentIconName {
  if (!code) return 'electric-switch';
  return EQUIPMENT_ICONS[code] || 'electric-switch';
}

export const EQUIPMENT_STATUS_COLORS: Record<string, string> = {
  not_started: '#64748B',
  in_progress: '#0369A1',
  completed: '#059669',
};

export const VISIT_STATUS_COLORS: Record<string, string> = {
  not_started: '#64748B',
  in_progress: '#0369A1',
  completed: '#059669',
  sent: '#0F766E',
  planned: '#D97706',
  sent_by_engineer: '#0F766E',
  sent_by_tm: '#7C3AED',
  corrected_by_tm: '#8B5CF6',
  awaiting_assignment: '#8B5CF6',
};

export const VISIT_STATUS_LABELS: Record<string, string> = {
  not_started: 'Не начат',
  in_progress: 'В работе',
  completed: 'Завершён',
  sent: 'Отправлен',
  planned: 'Запланирован',
  sent_by_engineer: 'Отпр. инженером',
  sent_by_tm: 'Отпр. ТМ',
  corrected_by_tm: 'Исправлен ТМ',
  awaiting_assignment: 'Ожидает',
};
