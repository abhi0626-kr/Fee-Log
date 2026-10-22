import {
  InsulinLog,
  FoodLog,
  ActivityLog,
  FeelLog,
  GlucoseLog,
  UnifiedLogItem,
  UserSettings,
  COMMON_FOOD_CHIPS,
  DEFAULT_ACTIVITY_CHIPS,
} from '@/types';
import { supabase, isSupabaseConfigured } from './supabase';
import { getTodayIST } from './date-utils';

const STORAGE_KEYS = {
  INSULIN: 't1d_insulin_logs',
  FOOD: 't1d_food_logs',
  ACTIVITY: 't1d_activity_logs',
  FEEL: 't1d_feel_logs',
  GLUCOSE: 't1d_glucose_logs',
  SETTINGS: 't1d_settings',
  QUEUE: 't1d_offline_queue',
  DISMISSED_GLUCOSE_PROMPT: 't1d_dismissed_glucose_prompt_date',
};

export const DEFAULT_SETTINGS: UserSettings = {
  display_name: 'Abhishek',
  height_cm: 173,
  weight_kg: 58,
  morning_regular_units: 20,
  night_30_70_units: 25,
  timezone: 'Asia/Kolkata',
  activity_chips: DEFAULT_ACTIVITY_CHIPS.map((a) => a.label),
  food_chips: COMMON_FOOD_CHIPS,
};

export interface SyncQueueItem {
  id: string;
  table: 'insulin_logs' | 'food_logs' | 'activity_logs' | 'feel_logs' | 'glucose_logs';
  action: 'insert' | 'update' | 'delete';
  payload: unknown;
  timestamp: string;
}

export function getIsOnline(): boolean {
  if (typeof window === 'undefined') return true;
  return navigator.onLine;
}

export function getSettings(): UserSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Partial<UserSettings>): UserSettings {
  const current = getSettings();
  const updated = { ...current, ...settings };
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
  }
  return updated;
}

export function isGlucosePromptDismissedToday(): boolean {
  if (typeof window === 'undefined') return false;
  const dismissedDate = localStorage.getItem(STORAGE_KEYS.DISMISSED_GLUCOSE_PROMPT);
  return dismissedDate === getTodayIST();
}

export function dismissGlucosePromptToday(): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.DISMISSED_GLUCOSE_PROMPT, getTodayIST());
  }
}

// Generic Local Storage Helpers
function getLocalArray<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalArray<T>(key: string, items: T[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch (err) {
    console.error(`Failed to save to localStorage for key ${key}:`, err);
  }
}

// Queue management
export function getOfflineQueue(): SyncQueueItem[] {
  return getLocalArray<SyncQueueItem>(STORAGE_KEYS.QUEUE);
}

function addToQueue(item: Omit<SyncQueueItem, 'timestamp'>) {
  const queue = getOfflineQueue();
  queue.push({
    ...item,
    timestamp: new Date().toISOString(),
  });
  saveLocalArray(STORAGE_KEYS.QUEUE, queue);
}

export function clearOfflineQueue() {
  saveLocalArray(STORAGE_KEYS.QUEUE, []);
}

// Synchronize queue if Supabase configured & online
export async function flushOfflineQueue(): Promise<{ synced: number; failed: number }> {
  if (!isSupabaseConfigured || !supabase || !getIsOnline()) {
    return { synced: 0, failed: 0 };
  }

  const queue = getOfflineQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;
  const remaining: SyncQueueItem[] = [];

  for (const item of queue) {
    try {
      if (item.action === 'insert') {
        const { error } = await supabase.from(item.table).insert([item.payload]);
        if (error) throw error;
      } else if (item.action === 'update') {
        const payload = item.payload as { id: string };
        const { error } = await supabase.from(item.table).update(payload).eq('id', payload.id);
        if (error) throw error;
      } else if (item.action === 'delete') {
        const { error } = await supabase.from(item.table).delete().eq('id', item.id);
        if (error) throw error;
      }
      synced++;
    } catch (e) {
      console.warn('Queue flush item failed, retaining in queue:', e);
      failed++;
      remaining.push(item);
    }
  }

  saveLocalArray(STORAGE_KEYS.QUEUE, remaining);
  return { synced, failed };
}

// INSULIN LOGS
export function getInsulinLogs(): InsulinLog[] {
  return getLocalArray<InsulinLog>(STORAGE_KEYS.INSULIN);
}

export function saveInsulinLog(log: Omit<InsulinLog, 'id' | 'created_at'> & { id?: string }): InsulinLog {
  const existing = getInsulinLogs();
  const id = log.id || crypto.randomUUID();
  const fullLog: InsulinLog = {
    ...log,
    id,
    created_at: new Date().toISOString(),
  };

  const index = existing.findIndex((item) => item.id === id);
  if (index >= 0) {
    existing[index] = fullLog;
    addToQueue({ id, table: 'insulin_logs', action: 'update', payload: fullLog });
  } else {
    existing.push(fullLog);
    addToQueue({ id, table: 'insulin_logs', action: 'insert', payload: fullLog });
  }

  saveLocalArray(STORAGE_KEYS.INSULIN, existing);
  return fullLog;
}

export function deleteInsulinLog(id: string): void {
  const existing = getInsulinLogs().filter((item) => item.id !== id);
  saveLocalArray(STORAGE_KEYS.INSULIN, existing);
  addToQueue({ id, table: 'insulin_logs', action: 'delete', payload: null });
}

// FOOD LOGS
export function getFoodLogs(): FoodLog[] {
  return getLocalArray<FoodLog>(STORAGE_KEYS.FOOD);
}

export function saveFoodLog(log: Omit<FoodLog, 'id' | 'created_at'> & { id?: string }): FoodLog {
  const existing = getFoodLogs();
  const id = log.id || crypto.randomUUID();
  const fullLog: FoodLog = {
    ...log,
    id,
    created_at: new Date().toISOString(),
  };

  const index = existing.findIndex((item) => item.id === id);
  if (index >= 0) {
    existing[index] = fullLog;
    addToQueue({ id, table: 'food_logs', action: 'update', payload: fullLog });
  } else {
    existing.push(fullLog);
    addToQueue({ id, table: 'food_logs', action: 'insert', payload: fullLog });
  }

  saveLocalArray(STORAGE_KEYS.FOOD, existing);
  return fullLog;
}

export function deleteFoodLog(id: string): void {
  const existing = getFoodLogs().filter((item) => item.id !== id);
  saveLocalArray(STORAGE_KEYS.FOOD, existing);
  addToQueue({ id, table: 'food_logs', action: 'delete', payload: null });
}

// ACTIVITY LOGS
export function getActivityLogs(): ActivityLog[] {
  return getLocalArray<ActivityLog>(STORAGE_KEYS.ACTIVITY);
}

export function saveActivityLog(log: Omit<ActivityLog, 'id' | 'created_at'> & { id?: string }): ActivityLog {
  const existing = getActivityLogs();
  const id = log.id || crypto.randomUUID();
  const fullLog: ActivityLog = {
    ...log,
    id,
    created_at: new Date().toISOString(),
  };

  const index = existing.findIndex((item) => item.id === id);
  if (index >= 0) {
    existing[index] = fullLog;
    addToQueue({ id, table: 'activity_logs', action: 'update', payload: fullLog });
  } else {
    existing.push(fullLog);
    addToQueue({ id, table: 'activity_logs', action: 'insert', payload: fullLog });
  }

  saveLocalArray(STORAGE_KEYS.ACTIVITY, existing);
  return fullLog;
}

export function deleteActivityLog(id: string): void {
  const existing = getActivityLogs().filter((item) => item.id !== id);
  saveLocalArray(STORAGE_KEYS.ACTIVITY, existing);
  addToQueue({ id, table: 'activity_logs', action: 'delete', payload: null });
}

// FEEL LOGS
export function getFeelLogs(): FeelLog[] {
  return getLocalArray<FeelLog>(STORAGE_KEYS.FEEL);
}

export function saveFeelLog(log: Omit<FeelLog, 'id' | 'created_at'> & { id?: string }): FeelLog {
  const existing = getFeelLogs();
  const id = log.id || crypto.randomUUID();
  const fullLog: FeelLog = {
    ...log,
    id,
    created_at: new Date().toISOString(),
  };

  const index = existing.findIndex((item) => item.id === id);
  if (index >= 0) {
    existing[index] = fullLog;
    addToQueue({ id, table: 'feel_logs', action: 'update', payload: fullLog });
  } else {
    existing.push(fullLog);
    addToQueue({ id, table: 'feel_logs', action: 'insert', payload: fullLog });
  }

  saveLocalArray(STORAGE_KEYS.FEEL, existing);
  return fullLog;
}

export function deleteFeelLog(id: string): void {
  const existing = getFeelLogs().filter((item) => item.id !== id);
  saveLocalArray(STORAGE_KEYS.FEEL, existing);
  addToQueue({ id, table: 'feel_logs', action: 'delete', payload: null });
}

// GLUCOSE LOGS (Nullable/Optional everywhere)
export function getGlucoseLogs(): GlucoseLog[] {
  return getLocalArray<GlucoseLog>(STORAGE_KEYS.GLUCOSE);
}

export function saveGlucoseLog(log: Omit<GlucoseLog, 'id' | 'created_at'> & { id?: string }): GlucoseLog {
  const existing = getGlucoseLogs();
  const id = log.id || crypto.randomUUID();
  const fullLog: GlucoseLog = {
    ...log,
    id,
    created_at: new Date().toISOString(),
  };

  const index = existing.findIndex((item) => item.id === id);
  if (index >= 0) {
    existing[index] = fullLog;
    addToQueue({ id, table: 'glucose_logs', action: 'update', payload: fullLog });
  } else {
    existing.push(fullLog);
    addToQueue({ id, table: 'glucose_logs', action: 'insert', payload: fullLog });
  }

  saveLocalArray(STORAGE_KEYS.GLUCOSE, existing);
  return fullLog;
}

export function deleteGlucoseLog(id: string): void {
  const existing = getGlucoseLogs().filter((item) => item.id !== id);
  saveLocalArray(STORAGE_KEYS.GLUCOSE, existing);
  addToQueue({ id, table: 'glucose_logs', action: 'delete', payload: null });
}

// MERGED CHRONOLOGICAL FEED
export function getUnifiedLogsForDate(dateStr: string): UnifiedLogItem[] {
  const insulin = getInsulinLogs().filter((l) => l.log_date === dateStr);
  const food = getFoodLogs().filter((l) => l.log_date === dateStr);
  const activity = getActivityLogs().filter((l) => l.log_date === dateStr);
  const feel = getFeelLogs().filter((l) => l.log_date === dateStr);
  const glucose = getGlucoseLogs().filter((l) => l.log_date === dateStr);

  const unified: UnifiedLogItem[] = [];

  insulin.forEach((l) =>
    unified.push({
      id: l.id,
      category: 'insulin',
      user_id: l.user_id,
      log_date: l.log_date,
      log_time: l.log_time,
      created_at: l.created_at,
      insulin: l,
    })
  );

  food.forEach((l) =>
    unified.push({
      id: l.id,
      category: 'food',
      user_id: l.user_id,
      log_date: l.log_date,
      log_time: l.log_time,
      created_at: l.created_at,
      food: l,
    })
  );

  activity.forEach((l) =>
    unified.push({
      id: l.id,
      category: 'activity',
      user_id: l.user_id,
      log_date: l.log_date,
      log_time: l.log_time,
      created_at: l.created_at,
      activity: l,
    })
  );

  feel.forEach((l) =>
    unified.push({
      id: l.id,
      category: 'feel',
      user_id: l.user_id,
      log_date: l.log_date,
      log_time: l.log_time,
      created_at: l.created_at,
      feel: l,
    })
  );

  glucose.forEach((l) =>
    unified.push({
      id: l.id,
      category: 'glucose',
      user_id: l.user_id,
      log_date: l.log_date,
      log_time: l.log_time,
      created_at: l.created_at,
      glucose: l,
    })
  );

  // Sort chronologically by log_time ascending
  return unified.sort((a, b) => a.log_time.localeCompare(b.log_time));
}

// Get all unique dates with logs (for streak calculation)
export function getAllLoggedDates(): string[] {
  const dates = new Set<string>();
  getInsulinLogs().forEach((l) => dates.add(l.log_date));
  getFoodLogs().forEach((l) => dates.add(l.log_date));
  getActivityLogs().forEach((l) => dates.add(l.log_date));
  getFeelLogs().forEach((l) => dates.add(l.log_date));
  getGlucoseLogs().forEach((l) => dates.add(l.log_date));
  return Array.from(dates);
}

// Reset / Clear all data
export function clearAllLocalData(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEYS.INSULIN);
  localStorage.removeItem(STORAGE_KEYS.FOOD);
  localStorage.removeItem(STORAGE_KEYS.ACTIVITY);
  localStorage.removeItem(STORAGE_KEYS.FEEL);
  localStorage.removeItem(STORAGE_KEYS.GLUCOSE);
  localStorage.removeItem(STORAGE_KEYS.QUEUE);
  localStorage.removeItem(STORAGE_KEYS.DISMISSED_GLUCOSE_PROMPT);
}

// DEMO DATA SEEDER
// Populates 14 days of realistic Bangalore PG student data
export function seedRealisticPGData(): void {
  clearAllLocalData();
  const userId = 'demo-user-pg-bangalore';

  const insulinList: InsulinLog[] = [];
  const foodList: FoodLog[] = [];
  const activityList: ActivityLog[] = [];
  const feelList: FeelLog[] = [];
  const glucoseList: GlucoseLog[] = [];

  const today = getTodayIST();
  const [ty, tm, td] = today.split('-').map(Number);
  const baseDate = new Date(Date.UTC(ty, tm - 1, td));

  // Loop back 14 days
  for (let i = 13; i >= 0; i--) {
    const curDate = new Date(baseDate.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = curDate.toISOString().slice(0, 10);
    const isToday = i === 0;

    // 1. Morning Insulin (Regular 20U at 07:45 or 08:00)
    // On today, let's leave night insulin pending so user can interact!
    insulinList.push({
      id: crypto.randomUUID(),
      user_id: userId,
      log_date: dateStr,
      log_time: '07:50',
      insulin_type: 'morning_regular',
      units: 20,
      taken: true,
      note: 'Before breakfast',
    });

    if (!isToday) {
      // Night Insulin (30/70 25U at 20:30)
      insulinList.push({
        id: crypto.randomUUID(),
        user_id: userId,
        log_date: dateStr,
        log_time: '20:30',
        insulin_type: 'night_30_70',
        units: 25,
        taken: true,
        note: 'Before PG dinner',
      });
    }

    // 2. Breakfast (08:15)
    foodList.push({
      id: crypto.randomUUID(),
      user_id: userId,
      log_date: dateStr,
      log_time: '08:15',
      meal: 'breakfast',
      items: i % 2 === 0 ? '3 idly, sambar' : '2 dosa, coconut chutney',
      carb_size: 'medium',
      note: 'PG mess breakfast',
    });

    // 3. Morning Run (5-10 km) on most days (day 1, 2, 4, 5, 7, 8, 10, 11, 13)
    if (i % 3 !== 0) {
      activityList.push({
        id: crypto.randomUUID(),
        user_id: userId,
        log_date: dateStr,
        log_time: '06:30',
        activity_type: 'run',
        duration_min: 45,
        intensity: 'moderate',
        note: 'Morning run around Koramangala park (6.5 km)',
      });
    }

    // 4. Lunch scenario variations
    if (i === 3 || i === 9) {
      // Skipped or severely delayed lunch scenario!
      // Day 3: Skipped lunch completely -> Low feel at 15:00
      if (i === 3) {
        feelList.push({
          id: crypto.randomUUID(),
          user_id: userId,
          log_date: dateStr,
          log_time: '15:15',
          feel: 'low',
          symptoms: ['shaky', 'sweaty', 'hungry', 'dizzy'],
          note: 'Forgot lunch due to lab session; felt shaking in class',
        });
        // Occasional paired glucose reading on low feel
        glucoseList.push({
          id: crypto.randomUUID(),
          user_id: userId,
          log_date: dateStr,
          log_time: '15:20',
          reading_mgdl: 58,
          context: 'other',
          note: 'Checked on friend meter; drank juice',
        });
      } else {
        // Day 9: Delayed lunch after 2pm (at 14:30)
        foodList.push({
          id: crypto.randomUUID(),
          user_id: userId,
          log_date: dateStr,
          log_time: '14:45',
          meal: 'lunch',
          items: 'rice with dal, curd',
          carb_size: 'large',
          note: 'Very late lunch after project meeting',
        });
        feelList.push({
          id: crypto.randomUUID(),
          user_id: userId,
          log_date: dateStr,
          log_time: '14:15',
          feel: 'slightly_low',
          symptoms: ['hungry', 'fast_heartbeat'],
          note: 'Stomach empty, felt shaky before late lunch',
        });
      }
    } else {
      // Normal lunch time: 13:00 - 13:30
      const isRiceDay = i % 2 === 0;
      const isDosaDay = i % 4 === 1;
      const carbSize = isRiceDay ? 'large' : 'medium';
      const items = isRiceDay
        ? 'rice, sambar, potato fry'
        : isDosaDay
        ? '3 dosa with chutney'
        : '3 chapathi with dal';

      foodList.push({
        id: crypto.randomUUID(),
        user_id: userId,
        log_date: dateStr,
        log_time: '13:15',
        meal: 'lunch',
        items,
        carb_size: carbSize,
        note: 'PG lunch',
      });

      // Afternoon high pattern (3pm - 7pm, e.g. 15:45 to 17:30)
      if (isRiceDay || isDosaDay) {
        feelList.push({
          id: crypto.randomUUID(),
          user_id: userId,
          log_date: dateStr,
          log_time: '16:30',
          feel: isRiceDay ? 'high' : 'slightly_high',
          symptoms: isRiceDay
            ? ['thirsty', 'tired', 'frequent_urination']
            : ['thirsty', 'tired'],
          note: 'Heavy afternoon sluggishness & thirst in PG room',
        });

        // Add 2 occasional glucose readings paired with high feels for calibration rule
        if (i === 4) {
          glucoseList.push({
            id: crypto.randomUUID(),
            user_id: userId,
            log_date: dateStr,
            log_time: '16:40',
            reading_mgdl: 265,
            context: 'post_lunch',
            note: 'Tested at local clinic pharmacy',
          });
        } else if (i === 8) {
          glucoseList.push({
            id: crypto.randomUUID(),
            user_id: userId,
            log_date: dateStr,
            log_time: '16:35',
            reading_mgdl: 240,
            context: 'post_lunch',
            note: 'Post lunch high',
          });
        }
      } else {
        // Chapathi day -> feel okay
        feelList.push({
          id: crypto.randomUUID(),
          user_id: userId,
          log_date: dateStr,
          log_time: '16:00',
          feel: 'okay',
          symptoms: [],
          note: 'Felt balanced after chapathi lunch',
        });
      }
    }

    // 5. Evening Calisthenics (18:30)
    if (i % 2 === 0) {
      activityList.push({
        id: crypto.randomUUID(),
        user_id: userId,
        log_date: dateStr,
        log_time: '18:30',
        activity_type: 'calisthenics',
        duration_min: 40,
        intensity: 'moderate',
        note: 'Pullups, dips, pushups at PG terrace',
      });
    }

    // 6. Dinner (20:45)
    if (!isToday) {
      foodList.push({
        id: crypto.randomUUID(),
        user_id: userId,
        log_date: dateStr,
        log_time: '20:45',
        meal: 'dinner',
        items: 'chapathi with veg kurma, egg',
        carb_size: 'medium',
        note: 'PG dinner',
      });
    }
  }

  saveLocalArray(STORAGE_KEYS.INSULIN, insulinList);
  saveLocalArray(STORAGE_KEYS.FOOD, foodList);
  saveLocalArray(STORAGE_KEYS.ACTIVITY, activityList);
  saveLocalArray(STORAGE_KEYS.FEEL, feelList);
  saveLocalArray(STORAGE_KEYS.GLUCOSE, glucoseList);
}
