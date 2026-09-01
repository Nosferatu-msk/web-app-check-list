export interface Visit {
  id: string;
  address_id: string;
  address: string;
  date: string;
  time_start: string;
  season: 'summer' | 'winter';
  status: VisitStatus;
  engineer_id?: string;
  engineer_name?: string;
  contract_number?: string;
  request_number?: string;
  tasks?: Task[];
  tasks_count?: number;
  completed_tasks_count?: number;
  created_at?: string;
  updated_at?: string;
}

export type VisitStatus = 
  | 'planned'
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'sent'
  | 'sent_by_engineer'
  | 'sent_by_tm'
  | 'corrected_by_tm'
  | 'awaiting_assignment';

export interface Task {
  id: string;
  visit_id: string;
  equipment_type_id: string;
  equipment_type_name?: string;
  equipment_type_code?: string;
  room_type_id?: string;
  room_type_name?: string;
  room_type_code?: string;
  object_equipment_id?: string;
  task_type: 'individual' | 'group_climate';
  status: TaskStatus;
  parameters?: Record<string, any>;
  conclusion?: Conclusion;
  additional_recommendations?: string;
  selected_recommendation_ids?: string[];
  photos?: Photo[];
  photos_count?: number;
  created_at?: string;
  updated_at?: string;
}

export type TaskStatus = 'not_started' | 'in_progress' | 'completed';

export type Conclusion = 'ok' | 'ok_with_notes' | 'faulty';

export interface Photo {
  id: string;
  task_id: string;
  moment: 'before' | 'after';
  file_path: string;
  file_name: string;
  uploaded: boolean;
  server_id?: string;
  created_at?: string;
}

export interface Address {
  id: string;
  full_address: string;
  city?: string;
  street?: string;
  house?: string;
  building?: string;
}

export interface EquipmentType {
  id: string;
  name: string;
  code: string;
  specialization?: string;
  photos_required: number;
}

export interface RoomType {
  id: string;
  name: string;
  code?: string;
}

export interface Recommendation {
  id: string;
  text: string;
  equipment_type_code?: string;
}
