export type UserRole = 'engineer' | 'tm' | 'admin';
export type Season = 'summer' | 'winter';
export type VisitStatus = 'planned' | 'not_started' | 'in_progress' | 'completed' | 'sent' | 'sent_by_engineer' | 'sent_by_tm' | 'corrected_by_tm';
export type TaskStatus = 'not_started' | 'in_progress' | 'completed';
export type Conclusion = 'ok' | 'ok_with_notes' | 'faulty';
export type PhotoMoment = 'before' | 'after';
export type TaskType = 'group_climate' | 'individual';
export type EquipmentItemStatus = 'ok' | 'not_ok';

export interface User {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  specializationVik?: boolean;
  specializationIszh?: boolean;
}

export interface Address {
  id: string;
  city: string;
  street: string;
  house: string;
  building?: string;
  fullAddress: string;
  customerEmail?: string;
}

export interface EquipmentType {
  id: string;
  name: string;
  code: string;
  photosRequired: number;
  isActive: boolean;
  specializationReq?: string | null;
}

export interface RoomType {
  id: string;
  name: string;
  code: string;
}

export interface Recommendation {
  id: string;
  equipmentTypeId: string;
  text: string;
  sortOrder: number;
  isActive: boolean;
}

export interface Visit {
  id: string;
  userId: string;
  addressId: string;
  engineerName: string;
  dateStart: string;
  timeStart: string;
  timeEnd?: string;
  season: Season;
  status: VisitStatus;
  assignedById?: string;
  assignedAt?: string;
  sentByEngineerAt?: string;
  sentByTmAt?: string;
  tmCorrected: boolean;
  isDeleted: boolean;
  deletedById?: string;
  deletedAt?: string;
  address?: Address;
  tasks?: Task[];
  user?: { id: string; fullName: string; email: string };
  assignedBy?: { id: string; fullName: string; email: string };
  deletedBy?: { id: string; fullName: string; email: string };
}

export interface Task {
  id: string;
  visitId: string;
  taskType: TaskType;
  equipmentTypeId: string;
  roomTypeId?: string;
  roomTypeCode?: string;
  objectEquipmentId?: string;
  comment?: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  sortOrder: number;
  status: TaskStatus;
  parameters?: Record<string, unknown>;
  selectedRecommendationIds: string[];
  additionalRecommendations?: string;
  conclusion?: Conclusion;
  equipmentType?: EquipmentType;
  roomType?: RoomType;
  photos?: Photo[];
  equipmentItems?: TaskEquipmentItem[];
}

export interface TaskEquipmentItem {
  id: string;
  taskId: string;
  objectEquipmentId: string;
  status?: EquipmentItemStatus;
  sortOrder: number;
  objectEquipment?: {
    id: string;
    equipmentTypeCode: string;
    brand?: string;
    model?: string;
    serialNumber?: string;
    roomTypeCode?: string;
    isOutdoorUnit: boolean;
  };
  photos?: Photo[];
}

export interface Photo {
  id: string;
  taskId?: string;
  taskEquipmentItemId?: string;
  fileName: string;
  filePath: string;
  moment: PhotoMoment;
  fileSize?: number;
  mimeType?: string;
}

export interface AuditLogEntry {
  id: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  user?: { fullName: string; email: string };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export const CONCLUSION_LABELS: Record<Conclusion, string> = {
  ok: 'Исправно, замечаний нет',
  ok_with_notes: 'Исправно, есть замечания',
  faulty: 'Неисправно',
};

export const SEASON_LABELS: Record<Season, string> = {
  summer: 'Лето',
  winter: 'Зима',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: 'Не начато',
  in_progress: 'В работе',
  completed: 'Выполнено',
};

export const EQUIPMENT_ITEM_STATUS_LABELS: Record<EquipmentItemStatus, string> = {
  ok: 'Исправно',
  not_ok: 'Неисправно',
};

// Коды климатического оборудования (внутренние блоки) для группировки
export const CLIMATE_INDOOR_CODES = ['splitvn', 'mssvn', 'vrv_vn'];
// Коды климатического оборудования (наружные блоки) для группировки
export const CLIMATE_OUTDOOR_CODES = ['splitnar', 'mssnar', 'vrv_nar'];
// Все коды климатического оборудования
export const CLIMATE_CODES = [...CLIMATE_INDOOR_CODES, ...CLIMATE_OUTDOOR_CODES];

export const ROLE_LABELS: Record<UserRole, string> = {
  engineer: 'Инженер',
  tm: 'Территориальный менеджер',
  admin: 'Администратор',
};

export const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  planned: 'Запланировано',
  not_started: 'Не начато',
  in_progress: 'В работе',
  completed: 'Завершён',
  sent: 'Отправлен',
  sent_by_engineer: 'Отправлен инженером',
  sent_by_tm: 'Отправлен ТМ',
  corrected_by_tm: 'Откорректирован ТМ',
};

export interface TmAssignment {
  id: string;
  tmId: string;
  addressId: string;
  createdAt: string;
  tm?: { id: string; fullName: string; email: string };
  address?: Address;
}

export interface TmEngineerAssignment {
  id: string;
  tmId: string;
  engineerId: string;
  createdAt: string;
  tm?: { id: string; fullName: string; email: string };
  engineer?: { id: string; fullName: string; email: string };
}

export interface ImportLogEntry {
  id: string;
  userId: string;
  entityType: string;
  fileName: string;
  totalRows: number;
  successRows: number;
  duplicateRows: number;
  errorRows: number;
  errors?: Record<string, unknown>;
  status: string;
  createdAt: string;
}

export function determineSeason(date: Date): Season {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  if ((month > 4 && month < 10) || (month === 4 && day >= 1) || (month === 10 && day <= 31)) {
    return 'summer';
  }
  return 'winter';
}
