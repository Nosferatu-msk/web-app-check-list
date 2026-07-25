export type UserRole = 'engineer' | 'tm' | 'admin';
export type Season = 'summer' | 'winter';
export type VisitStatus = 'planned' | 'not_started' | 'in_progress' | 'completed' | 'sent' | 'sent_by_engineer' | 'sent_by_tm' | 'corrected_by_tm' | 'awaiting_assignment';
export type TaskStatus = 'not_started' | 'in_progress' | 'completed';
export type Conclusion = 'ok' | 'ok_with_notes' | 'faulty';
export type PhotoMoment = 'before' | 'after';
export type TaskType = 'group_climate' | 'individual';
export type EquipmentItemStatus = 'ok' | 'not_ok';
export type ModelStatus = 'approved' | 'pending' | 'rejected';
export type ConfirmationStatus = 'confirmed' | 'pending';
export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'expired';
export type RequestType = 'new_equipment' | 'room_change' | 'brand_change';
export type NotificationType =
  | 'proposal_created'
  | 'proposal_approved'
  | 'proposal_rejected'
  | 'proposal_expiring_soon'
  | 'proposal_expired'
  | 'equipment_removed'
  | 'request_assigned'
  | 'request_unassigned'
  | 'request_declined'
  | 'request_imported';

export type ImportStatus = 'new' | 'matched' | 'created' | 'error' | 'skipped';
export type AssignmentAction = 'assigned' | 'unassigned' | 'declined';

export interface User {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  specializationVik?: boolean;
  specializationIszh?: boolean;
  specializationGpm?: boolean;
  specializationDgu?: boolean;
  specializationIbp?: boolean;
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

export interface Manufacturer {
  id: string;
  name: string;
  country?: string | null;
  isActive: boolean;
}

export interface Model {
  id: string;
  equipmentTypeId: string;
  manufacturerId: string;
  modelName: string;
  fullModelName?: string | null;
  status: ModelStatus;
  submittedById?: string | null;
  submittedAt?: string | null;
  reviewedById?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  equipmentType?: EquipmentType;
  manufacturer?: Manufacturer;
  submittedBy?: { id: string; fullName: string; email: string };
  reviewedBy?: { id: string; fullName: string; email: string };
}

export interface Visit {
  id: string;
  userId: string | null;
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
  isMultiSpecialist: boolean;
  isDeleted: boolean;
  deletedById?: string;
  deletedAt?: string;
  address?: Address;
  tasks?: Task[];
  user?: { id: string; fullName: string; email: string } | null;
  assignedBy?: { id: string; fullName: string; email: string };
  deletedBy?: { id: string; fullName: string; email: string };
  visitEngineers?: VisitEngineer[];
}

export interface Task {
  id: string;
  visitId: string;
  taskType: TaskType;
  equipmentTypeId: string;
  roomTypeId?: string;
  roomTypeCode?: string;
  objectEquipmentId?: string;
  externalRequestId?: string;
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

export const MODEL_STATUS_LABELS: Record<ModelStatus, string> = {
  approved: 'Утверждена',
  pending: 'На модерации',
  rejected: 'Отклонена',
};

export const CONFIRMATION_STATUS_LABELS: Record<ConfirmationStatus, string> = {
  confirmed: 'Подтверждено',
  pending: 'Ожидает подтверждения',
};

export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  pending: 'Ожидает рассмотрения',
  approved: 'Подтверждено',
  rejected: 'Отклонено',
  expired: 'Истекло',
};

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  new_equipment: 'Новое оборудование',
  room_change: 'Перенос оборудования',
  brand_change: 'Смена бренда/модели',
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
  awaiting_assignment: 'Ожидает назначения',
};

export const IMPORT_STATUS_LABELS: Record<ImportStatus, string> = {
  new: 'Новая',
  matched: 'Сопоставлена',
  created: 'Создана',
  error: 'Ошибка',
  skipped: 'Пропущена',
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

export interface ObjectEquipment {
  id: string;
  addressId: string;
  equipmentTypeCode: string;
  roomTypeCode?: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  locationDescription?: string;
  isOutdoorUnit: boolean;
  isActive: boolean;
  confirmationStatus: ConfirmationStatus;
  createdBy?: string;
  pendingUntil?: string;
  roomConfirmedAt?: string;
  roomConfirmedBy?: string;
  createdAt: string;
  updatedAt: string;
  roomType?: RoomType;
}

export interface EquipmentProposal {
  id: string;
  addressId: string;
  equipmentTypeCode: string;
  roomTypeCode: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  locationDescription?: string;
  proposedById: string;
  status: ProposalStatus;
  reviewedById?: string;
  reviewedAt?: string;
  requestType: RequestType;
  oldRoomTypeCode?: string;
  rejectionReason?: string;
  pendingUntil?: string;
  objectEquipmentId?: string;
  createdAt: string;
  updatedAt: string;
  address?: Address;
  proposedBy?: { id: string; fullName: string; email: string };
  reviewedBy?: { id: string; fullName: string; email: string };
  objectEquipment?: ObjectEquipment;
  roomType?: RoomType;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  isRead: boolean;
  createdAt: string;
}

export interface ImportedRequest {
  id: string;
  externalRequestId: string;
  externalStatus?: string;
  equipmentTypeId: string;
  equipmentTypeCode?: string;
  objectCode: string;
  addressRaw?: string;
  matchedAddressId?: string;
  visitId?: string;
  importStatus: ImportStatus;
  errorMessage?: string;
  importedBy?: string;
  importedAt: string;
  createdAt: string;
  equipmentType?: EquipmentType;
  matchedAddress?: Address;
  visit?: Visit;
}

export interface VisitEngineer {
  id: string;
  visitId: string;
  engineerId: string;
  isPrimary: boolean;
  assignedBy?: string;
  assignedAt: string;
  engineer?: { id: string; fullName: string; email: string };
}

export interface RequestAssignmentLogEntry {
  id: string;
  importedRequestId: string;
  action: AssignmentAction;
  engineerId?: string;
  performedBy?: string;
  reason?: string;
  createdAt: string;
  engineer?: { id: string; fullName: string; email: string };
  performer?: { id: string; fullName: string; email: string };
}

export interface ImportRequestsResult {
  importLogId: string;
  total: number;
  created: number;
  matched: number;
  skipped: number;
  errors: number;
  errorDetails: { row: number; externalRequestId: string; message: string }[];
}

export function determineSeason(date: Date): Season {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  if ((month > 4 && month < 10) || (month === 4 && day >= 1) || (month === 10 && day <= 31)) {
    return 'summer';
  }
  return 'winter';
}
