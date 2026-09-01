export type EquipmentIconName =
  | 'flash'
  | 'fan'
  | 'air-conditioner'
  | 'thermometer-water'
  | 'gauge'
  | 'lightning-bolt'
  | 'water-pump'
  | 'pipe'
  | 'air-conditioner-outdoor';

const EQUIPMENT_ICONS: Record<string, EquipmentIconName> = {
  rsch: 'flash',
  vent: 'fan',
  vrv_vn: 'air-conditioner',
  mssvn: 'air-conditioner',
  splitvn: 'air-conditioner',
  vrv_nar: 'air-conditioner-outdoor',
  mssnar: 'air-conditioner-outdoor',
  splitnar: 'air-conditioner-outdoor',
  schetchik_gvs: 'gauge',
  schetchik_hvs: 'gauge',
  schetchik_electroshc: 'lightning-bolt',
  seti_vodosnab: 'water-pump',
  teplovye_seti: 'pipe',
};

export function getEquipmentIcon(code?: string): EquipmentIconName {
  if (!code) return 'flash';
  return EQUIPMENT_ICONS[code] || 'flash';
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
