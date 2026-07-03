export type UserRole = 'engineer' | 'admin';
export type Season = 'summer' | 'winter';
export type VisitStatus = 'in_progress' | 'completed' | 'sent';
export type TaskStatus = 'not_started' | 'in_progress' | 'completed';
export type Conclusion = 'ok' | 'ok_with_notes' | 'faulty';
export type PhotoMoment = 'before' | 'after';

export interface User {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
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
  address?: Address;
  tasks?: Task[];
}

export interface Task {
  id: string;
  visitId: string;
  equipmentTypeId: string;
  roomTypeId?: string;
  location?: string;
  sortOrder: number;
  status: TaskStatus;
  parameters?: Record<string, unknown>;
  selectedRecommendationIds: string[];
  additionalRecommendations?: string;
  conclusion?: Conclusion;
  equipmentType?: EquipmentType;
  roomType?: RoomType;
  photos?: Photo[];
}

export interface Photo {
  id: string;
  taskId: string;
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

export function determineSeason(date: Date): Season {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  if ((month > 4 && month < 10) || (month === 4 && day >= 1) || (month === 10 && day <= 31)) {
    return 'summer';
  }
  return 'winter';
}
