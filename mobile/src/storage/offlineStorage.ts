import { getDatabase } from '../db';
import type { Visit, Task, VisitStatus } from '../types';

interface LocalVisitRow {
  id: string;
  address_id: string;
  address: string;
  date: string;
  time_start: string;
  season: string;
  status: string;
  engineer_id: string | null;
  engineer_name: string | null;
  latitude: number | null;
  longitude: number | null;
  gps_accuracy: number | null;
  dirty: number;
  created_at: string | null;
  updated_at: string | null;
  tasks_count: number;
  completed_tasks_count: number;
}

interface LocalTaskRow {
  id: string;
  visit_id: string;
  equipment_type_id: string;
  equipment_type_name: string | null;
  equipment_type_code: string | null;
  room_type_id: string | null;
  room_type_name: string | null;
  room_type_code: string | null;
  object_equipment_id: string | null;
  task_type: string;
  status: string;
  parameters: string | null;
  conclusion: string | null;
  additional_recommendations: string | null;
  selected_recommendation_ids: string | null;
  created_at: string | null;
  updated_at: string | null;
  photos_count: number;
}

function mapLocalVisit(row: LocalVisitRow): Visit {
  return {
    id: row.id,
    address_id: row.address_id,
    address: row.address,
    date: row.date,
    time_start: row.time_start,
    season: row.season as 'summer' | 'winter',
    status: row.status as VisitStatus,
    engineer_id: row.engineer_id || undefined,
    engineer_name: row.engineer_name || undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    gps_accuracy: row.gps_accuracy ?? undefined,
    tasks_count: row.tasks_count,
    completed_tasks_count: row.completed_tasks_count,
    created_at: row.created_at || undefined,
    updated_at: row.updated_at || undefined,
  };
}

function mapLocalTask(row: LocalTaskRow): Task {
  return {
    id: row.id,
    visit_id: row.visit_id,
    equipment_type_id: row.equipment_type_id,
    equipment_type_name: row.equipment_type_name || undefined,
    equipment_type_code: row.equipment_type_code || undefined,
    room_type_id: row.room_type_id || undefined,
    room_type_name: row.room_type_name || undefined,
    room_type_code: row.room_type_code || undefined,
    object_equipment_id: row.object_equipment_id || undefined,
    task_type: (row.task_type as 'individual' | 'group_climate') || 'individual',
    status: row.status as Task['status'],
    parameters: row.parameters ? JSON.parse(row.parameters) : undefined,
    conclusion: (row.conclusion as Task['conclusion']) || undefined,
    additional_recommendations: row.additional_recommendations || undefined,
    selected_recommendation_ids: row.selected_recommendation_ids
      ? JSON.parse(row.selected_recommendation_ids)
      : undefined,
    photos_count: row.photos_count,
    created_at: row.created_at || undefined,
    updated_at: row.updated_at || undefined,
  };
}

export async function getLocalVisits(): Promise<Visit[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<LocalVisitRow>(
    `SELECT v.*,
       (SELECT COUNT(*) FROM tasks t WHERE t.visit_id = v.id) as tasks_count,
       (SELECT COUNT(*) FROM tasks t WHERE t.visit_id = v.id AND t.status = 'completed') as completed_tasks_count
     FROM visits v
     ORDER BY v.created_at DESC`
  );
  return rows.map(mapLocalVisit);
}

export async function getLocalVisit(visitId: string): Promise<Visit | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<LocalVisitRow>(
    `SELECT v.*,
       (SELECT COUNT(*) FROM tasks t WHERE t.visit_id = v.id) as tasks_count,
       (SELECT COUNT(*) FROM tasks t WHERE t.visit_id = v.id AND t.status = 'completed') as completed_tasks_count
     FROM visits v WHERE v.id = ?`,
    [visitId]
  );
  return row ? mapLocalVisit(row) : null;
}

export async function getLocalTasks(visitId: string): Promise<Task[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<LocalTaskRow>(
    `SELECT t.*,
       eq.code as equipment_type_code,
       rt.code as room_type_code,
       (SELECT COUNT(*) FROM photos p WHERE p.task_id = t.id) as photos_count
     FROM tasks t
     LEFT JOIN cached_equipment_types eq ON eq.id = t.equipment_type_id
     LEFT JOIN cached_room_types rt ON rt.id = t.room_type_id
     WHERE t.visit_id = ?
     ORDER BY t.created_at ASC`,
    [visitId]
  );
  return rows.map(mapLocalTask);
}

export async function getLocalTask(taskId: string): Promise<Task | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<LocalTaskRow>(
    `SELECT t.*,
       eq.code as equipment_type_code,
       rt.code as room_type_code,
       (SELECT COUNT(*) FROM photos p WHERE p.task_id = t.id) as photos_count
     FROM tasks t
     LEFT JOIN cached_equipment_types eq ON eq.id = t.equipment_type_id
     LEFT JOIN cached_room_types rt ON rt.id = t.room_type_id
     WHERE t.id = ?`,
    [taskId]
  );
  return row ? mapLocalTask(row) : null;
}

export async function getLocalVisitWithTasks(visitId: string): Promise<Visit | null> {
  const visit = await getLocalVisit(visitId);
  if (!visit) return null;
  visit.tasks = await getLocalTasks(visitId);
  return visit;
}

export async function hasPendingLocalData(): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM visits WHERE dirty = 1
     UNION ALL
     SELECT COUNT(*) as count FROM tasks WHERE dirty = 1`
  );
  return (result?.count || 0) > 0;
}
