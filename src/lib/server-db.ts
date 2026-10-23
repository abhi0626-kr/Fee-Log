import fs from 'fs';
import path from 'path';
import {
  InsulinLog,
  FoodLog,
  ActivityLog,
  FeelLog,
  GlucoseLog,
  Profile,
} from '@/types';

export interface DatabaseSchema {
  profiles: Profile[];
  insulin_logs: InsulinLog[];
  food_logs: FoodLog[];
  activity_logs: ActivityLog[];
  feel_logs: FeelLog[];
  glucose_logs: GlucoseLog[];
}

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

const INITIAL_DB: DatabaseSchema = {
  profiles: [],
  insulin_logs: [],
  food_logs: [],
  activity_logs: [],
  feel_logs: [],
  glucose_logs: [],
};

// Ensure data directory and file exist
function ensureDatabase(): void {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_DB, null, 2), 'utf-8');
    }
  } catch (err) {
    console.error('Error initializing server database:', err);
  }
}

export function readDatabase(): DatabaseSchema {
  ensureDatabase();
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return INITIAL_DB;
  }
}

export function writeDatabase(data: DatabaseSchema): void {
  ensureDatabase();
  // Atomic write via temp file
  const tempFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tempFile, DB_FILE);
}

export type TableName = keyof DatabaseSchema;

export function insertOrUpdateRecord<T extends { id: string }>(
  table: TableName,
  record: T
): T {
  const db = readDatabase();
  const list = (db[table] as unknown as T[]) || [];
  const index = list.findIndex((item) => item.id === record.id);

  if (index >= 0) {
    list[index] = { ...list[index], ...record };
  } else {
    list.push(record);
  }

  (db[table] as unknown as T[]) = list;
  writeDatabase(db);
  return record;
}

export function deleteRecord(table: TableName, id: string): boolean {
  const db = readDatabase();
  const list = (db[table] as unknown as { id: string }[]) || [];
  const filtered = list.filter((item) => item.id !== id);

  if (filtered.length !== list.length) {
    (db[table] as unknown as typeof filtered) = filtered;
    writeDatabase(db);
    return true;
  }
  return false;
}
