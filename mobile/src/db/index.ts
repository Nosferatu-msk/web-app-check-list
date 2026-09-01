import * as SQLite from 'expo-sqlite';

const DB_NAME = 'checklist.db';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync(DB_NAME);
    await initializeDatabase(db);
  }
  return db;
}

async function initializeDatabase(db: SQLite.SQLiteDatabase) {
  // Визиты
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS visits (
      id TEXT PRIMARY KEY,
      address_id TEXT NOT NULL,
      address TEXT NOT NULL,
      date TEXT NOT NULL,
      time_start TEXT NOT NULL,
      season TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_started',
      engineer_id TEXT,
      engineer_name TEXT,
      latitude REAL,
      longitude REAL,
      gps_accuracy REAL,
      created_at TEXT,
      updated_at TEXT,
      dirty INTEGER DEFAULT 0,
      server_id TEXT,
      sync_error TEXT
    );
  `);

  // Задачи
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      visit_id TEXT NOT NULL,
      equipment_type_id TEXT NOT NULL,
      equipment_type_name TEXT,
      room_type_id TEXT,
      room_type_name TEXT,
      object_equipment_id TEXT,
      task_type TEXT DEFAULT 'individual',
      status TEXT NOT NULL DEFAULT 'not_started',
      parameters TEXT,
      conclusion TEXT,
      additional_recommendations TEXT,
      selected_recommendation_ids TEXT,
      created_at TEXT,
      updated_at TEXT,
      dirty INTEGER DEFAULT 0,
      sync_error TEXT,
      FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE CASCADE
    );
  `);

  // Фото
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      moment TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      uploaded INTEGER DEFAULT 0,
      server_id TEXT,
      created_at TEXT,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );
  `);

  // Кешированные адреса
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS cached_addresses (
      id TEXT PRIMARY KEY,
      full_address TEXT NOT NULL,
      city TEXT,
      street TEXT,
      house TEXT,
      building TEXT
    );
  `);

  // Кешированное оборудование объекта
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS cached_object_equipment (
      id TEXT PRIMARY KEY,
      address_id TEXT NOT NULL,
      equipment_type_id TEXT NOT NULL,
      equipment_type_name TEXT,
      room_type_id TEXT,
      room_type_name TEXT,
      brand TEXT,
      model TEXT,
      serial_number TEXT,
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY (address_id) REFERENCES cached_addresses(id)
    );
  `);

  // Кешированные типы оборудования
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS cached_equipment_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      specialization TEXT,
      photos_required INTEGER DEFAULT 1
    );
  `);

  // Кешированные типы помещений
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS cached_room_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT
    );
  `);

  // Кешированные рекомендации
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS cached_recommendations (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      equipment_type_code TEXT
    );
  `);

  // Очередь синхронизации
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_mutation_id TEXT NOT NULL UNIQUE,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      payload TEXT,
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 5,
      status TEXT DEFAULT 'pending',
      error TEXT,
      created_at TEXT
    );
  `);

  // Индексы
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_tasks_visit ON tasks(visit_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_dirty ON tasks(dirty) WHERE dirty = 1;
    CREATE INDEX IF NOT EXISTS idx_photos_task ON photos(task_id);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
    CREATE INDEX IF NOT EXISTS idx_visits_status ON visits(status);
    CREATE INDEX IF NOT EXISTS idx_visits_dirty ON visits(dirty) WHERE dirty = 1;
    CREATE INDEX IF NOT EXISTS idx_cached_object_equipment_address ON cached_object_equipment(address_id);
  `);
}

export async function closeDatabase() {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}
