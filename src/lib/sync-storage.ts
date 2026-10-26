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
import { estimateNutrientsFromItems } from './macro-calculator';

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
  email: '',
  auth_provider: 'guest',
  is_logged_in: false,
  age: 20,
  gender: 'Male',
  height_cm: 173,
  weight_kg: 58,

  city: 'Bangalore',
  residence_area: 'Koramangala PG',
  native_location: 'Coimbatore, Tamil Nadu',
  lifestyle_note: 'Studying & Running away from native Tamil Nadu',
  timezone: 'Asia/Kolkata',

  doctor_name: 'Dr. S. Ramanathan, MD',
  doctor_phone: '+91 98420 12345',
  clinic_name: 'Coimbatore Endocrine Clinic / Manipal BLR',
  emergency_contact_name: 'Parent / Friend',
  emergency_contact_phone: '+91 98765 43210',

  morning_insulin_brand: 'Regular (R)',
  morning_regular_units: 20,
  morning_target_time: '08:00',
  morning_meal_note: 'Before breakfast (Idly / Dosa)',

  midday_insulin_brand: 'Regular (R)',
  afternoon_regular_units: 10,
  midday_target_time: '13:30',
  midday_meal_note: 'Before lunch / body condition',

  night_insulin_brand: '30/70 Biphasic Mix',
  night_30_70_units: 25,
  night_target_time: '20:30',
  night_meal_note: 'Before dinner (Chapati / Rice)',

  correction_insulin_brand: 'Regular (R)',
  correction_default_units: 4,

  // Daily Nutrition & Macro Targets (Fitness Tracker style)
  daily_target_carbs_g: 180,
  daily_target_protein_g: 75,
  daily_target_fiber_g: 30,
  daily_max_sodium_mg: 2300,
  daily_target_calories: 2000,
  gemini_api_key: '',

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

export interface SyncResult {
  synced: number;
  failed: number;
  reason?: 'NO_AUTH_SESSION' | 'OFFLINE' | 'ERROR';
  errorMessage?: string;
}

let flushPromise: Promise<SyncResult> | null = null;

export function getIsOnline(): boolean {
  if (typeof window === 'undefined') return true;
  return navigator.onLine;
}

export function getSettings(): UserSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    // Automatic cleanup: clear placeholder mock email so user can use their real email
    if (parsed.email === 'abhishek@gmail.com') {
      parsed.email = '';
      parsed.auth_provider = 'guest';
      try {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify({ ...DEFAULT_SETTINGS, ...parsed }));
      } catch {
        // ignore
      }
    }
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Partial<UserSettings>): UserSettings {
  const current = getSettings();
  const updated = { ...current, ...settings };
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('t1d-data-updated'));
  }
  return updated;
}

export function getActiveUserId(): string {
  if (typeof window === 'undefined') return '00000000-0000-0000-0000-000000000000';
  const settings = getSettings();
  if (settings.user_id && settings.user_id.length > 10) {
    return settings.user_id;
  }
  const storedId = localStorage.getItem('t1d_user_id');
  if (storedId && storedId.length > 10) {
    return storedId;
  }
  let anonId = localStorage.getItem('t1d_anon_uuid');
  if (!anonId) {
    anonId = crypto.randomUUID();
    localStorage.setItem('t1d_anon_uuid', anonId);
  }
  return anonId;
}

export async function hasActiveCloudSession(): Promise<boolean> {
  if (typeof window === 'undefined' || !isSupabaseConfigured || !supabase) return false;
  try {
    let { data } = await supabase.auth.getSession();
    if (!data.session) {
      const refreshed = await supabase.auth.refreshSession();
      data = refreshed.data;
    }
    return Boolean(data.session?.user);
  } catch {
    return false;
  }
}

export async function getCloudAuthUserId(): Promise<string | null> {
  if (typeof window === 'undefined' || !isSupabaseConfigured || !supabase) return null;
  try {
    let { data } = await supabase.auth.getSession();
    if (!data.session) {
      const refreshed = await supabase.auth.refreshSession();
      data = refreshed.data;
    }
    return data.session?.user?.id || null;
  } catch {
    return null;
  }
}

export function isUserLoggedIn(): boolean {
  if (typeof window === 'undefined') return false;
  // 1. Direct explicit flag
  const flag = localStorage.getItem('t1d_is_logged_in');
  if (flag === 'true') return true;
  if (flag === 'false') return false;

  // 2. Settings check
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (parsed.is_logged_in === true) return true;
    if (parsed.is_logged_in === false) return false;
    // Fallback: If user has their email stored
    if (parsed.email && parsed.email.trim().length > 0 && parsed.email !== 'abhishek@gmail.com') {
      localStorage.setItem('t1d_is_logged_in', 'true');
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export function setUserLoggedIn(loggedIn: boolean, updates?: Partial<UserSettings>): UserSettings {
  if (typeof window !== 'undefined') {
    localStorage.setItem('t1d_is_logged_in', loggedIn ? 'true' : 'false');
    if (updates?.user_id) {
      localStorage.setItem('t1d_user_id', updates.user_id);
    } else if (!loggedIn) {
      localStorage.removeItem('t1d_user_id');
    }
  }
  return saveSettings({
    is_logged_in: loggedIn,
    ...updates,
  });
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
    window.dispatchEvent(new CustomEvent('t1d-data-updated'));
  } catch (err) {
    console.error(`Failed to save to localStorage for key ${key}:`, err);
  }
}

// Helper to merge local and remote arrays without duplicates
function mergeRecordsById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const map = new Map<string, T>();
  existing.forEach((item) => map.set(item.id, item));
  incoming.forEach((item) => map.set(item.id, item));
  return Array.from(map.values());
}

function acknowledgeSyncedRecords(table: SyncQueueItem['table'], ids: Set<string>): void {
  if (ids.size === 0) return;
  const queue = getOfflineQueue();
  const remaining = queue.filter((item) => !(item.table === table && ids.has(item.id)));
  if (remaining.length !== queue.length) {
    saveLocalArray(STORAGE_KEYS.QUEUE, remaining);
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

// Synchronize queue with Supabase Postgres
async function flushOfflineQueueInternal(): Promise<SyncResult> {
  if (!getIsOnline()) {
    return { synced: 0, failed: 0, reason: 'OFFLINE' };
  }

  const queue = getOfflineQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let authUserId: string | null = null;
  if (isSupabaseConfigured && supabase) {
    try {
      let { data } = await supabase.auth.getSession();
      if (!data.session) {
        const refreshed = await supabase.auth.refreshSession();
        data = refreshed.data;
      }
      authUserId = data.session?.user?.id || null;
    } catch {
      authUserId = null;
    }
  }

  const remainingQueue: SyncQueueItem[] = [];
  let synced = 0;
  let failed = 0;
  let lastErrorMsg: string | undefined;

  // 1. Sync directly to Supabase if authenticated
  if (isSupabaseConfigured && supabase && authUserId) {
    for (const item of queue) {
      try {
        if (item.action === 'insert' || item.action === 'update') {
          const payload = {
            ...(item.payload as Record<string, unknown>),
            user_id: authUserId,
          };
          const { error } = await supabase.from(item.table).upsert([payload]);
          if (error) throw error;
          synced++;
        } else if (item.action === 'delete') {
          const { error } = await supabase
            .from(item.table)
            .delete()
            .eq('id', item.id)
            .eq('user_id', authUserId);
          if (error) throw error;
          synced++;
        }
      } catch (e) {
        const msg = (e as { message?: string })?.message || String(e);
        lastErrorMsg = msg;
        console.warn(`Supabase sync item error on ${item.table}:`, msg);
        remainingQueue.push(item);
        failed++;
      }
    }
  } else if (!isSupabaseConfigured || !supabase) {
    // 2. The file-backed endpoint is used for local development without Supabase
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: queue }),
      });
      if (res.ok) {
        synced = queue.length;
      } else {
        remainingQueue.push(...queue);
        failed = queue.length;
      }
    } catch (error) {
      console.warn('Server fallback sync failed:', error);
      remainingQueue.push(...queue);
      failed = queue.length;
    }
  } else {
    // Supabase is configured, but user has no active cloud auth session.
    // Retain in offline queue until signed in.
    remainingQueue.push(...queue);
    failed = queue.length;
    saveLocalArray(STORAGE_KEYS.QUEUE, remainingQueue);
    return {
      synced: 0,
      failed: queue.length,
      reason: 'NO_AUTH_SESSION',
      errorMessage: 'Cloud session not active. Sign in with Google to sync pending logs.',
    };
  }

  saveLocalArray(STORAGE_KEYS.QUEUE, remainingQueue);
  return {
    synced,
    failed,
    reason: failed > 0 ? (lastErrorMsg ? 'ERROR' : 'NO_AUTH_SESSION') : undefined,
    errorMessage: lastErrorMsg,
  };
}

export function flushOfflineQueue(): Promise<SyncResult> {
  if (!flushPromise) {
    flushPromise = flushOfflineQueueInternal().finally(() => {
      flushPromise = null;
    });
  }
  return flushPromise;
}

// Hydrate local cache from Supabase Postgres with two-way sync
export async function hydrateFromSupabase(targetUserId?: string): Promise<boolean> {
  if (typeof window === 'undefined' || !getIsOnline() || !isSupabaseConfigured || !supabase) {
    return false;
  }

  try {
    let userId = targetUserId;
    if (!userId) {
      let { data } = await supabase.auth.getSession();
      if (!data.session) {
        const refreshed = await supabase.auth.refreshSession();
        data = refreshed.data;
      }
      userId = data.session?.user?.id;
    }
    if (!userId) {
      return false;
    }

    const [insulinRes, foodRes, activityRes, feelRes, glucoseRes] = await Promise.all([
      supabase.from('insulin_logs').select('*').eq('user_id', userId),
      supabase.from('food_logs').select('*').eq('user_id', userId),
      supabase.from('activity_logs').select('*').eq('user_id', userId),
      supabase.from('feel_logs').select('*').eq('user_id', userId),
      supabase.from('glucose_logs').select('*').eq('user_id', userId),
    ]);

    const queryErrors = [
      insulinRes.error,
      foodRes.error,
      activityRes.error,
      feelRes.error,
      glucoseRes.error,
    ].filter(Boolean);
    if (queryErrors.length > 0) {
      throw new Error(
        `Unable to load logs from Supabase: ${queryErrors
          .map((error) => error?.message)
          .join('; ')}`
      );
    }

    // 1. Two-way Insulin Sync: upload any local logs missing from Supabase, then merge
    const localInsulin = getInsulinLogs();
    const remoteInsulin = (insulinRes.data as InsulinLog[]) || [];
    const remoteInsulinIds = new Set(remoteInsulin.map((r) => r.id));
    const unuploadedInsulin = localInsulin
      .filter((l) => !remoteInsulinIds.has(l.id))
      .map((l) => ({ ...l, user_id: userId }));

    let insulinUploadSucceeded = true;
    if (unuploadedInsulin.length > 0) {
      const { error } = await supabase.from('insulin_logs').upsert(unuploadedInsulin);
      if (error) {
        insulinUploadSucceeded = false;
        console.warn('Failed to upsert unuploaded insulin logs:', error.message);
      }
    }
    if (insulinUploadSucceeded) {
      unuploadedInsulin.forEach((record) => remoteInsulinIds.add(record.id));
    }
    acknowledgeSyncedRecords('insulin_logs', remoteInsulinIds);
    const mergedInsulin = mergeRecordsById(
      localInsulin.map((record) => ({ ...record, user_id: userId })),
      remoteInsulin
    );
    saveLocalArray(STORAGE_KEYS.INSULIN, mergedInsulin);

    // 2. Two-way Food Sync
    const localFood = getFoodLogs();
    const remoteFood = (foodRes.data as FoodLog[]) || [];
    const remoteFoodIds = new Set(remoteFood.map((r) => r.id));
    const unuploadedFood = localFood
      .filter((l) => !remoteFoodIds.has(l.id))
      .map((l) => ({ ...l, user_id: userId }));

    let foodUploadSucceeded = true;
    if (unuploadedFood.length > 0) {
      const { error } = await supabase.from('food_logs').upsert(unuploadedFood);
      if (error) {
        foodUploadSucceeded = false;
        console.warn('Failed to upsert unuploaded food logs:', error.message);
      }
    }
    if (foodUploadSucceeded) {
      unuploadedFood.forEach((record) => remoteFoodIds.add(record.id));
    }
    acknowledgeSyncedRecords('food_logs', remoteFoodIds);
    const mergedFood = mergeRecordsById(
      localFood.map((record) => ({ ...record, user_id: userId })),
      remoteFood
    );
    saveLocalArray(STORAGE_KEYS.FOOD, mergedFood);

    // 3. Two-way Activity Sync
    const localActivity = getActivityLogs();
    const remoteActivity = (activityRes.data as ActivityLog[]) || [];
    const remoteActivityIds = new Set(remoteActivity.map((r) => r.id));
    const unuploadedActivity = localActivity
      .filter((l) => !remoteActivityIds.has(l.id))
      .map((l) => ({ ...l, user_id: userId }));

    let activityUploadSucceeded = true;
    if (unuploadedActivity.length > 0) {
      const { error } = await supabase.from('activity_logs').upsert(unuploadedActivity);
      if (error) {
        activityUploadSucceeded = false;
        console.warn('Failed to upsert unuploaded activity logs:', error.message);
      }
    }
    if (activityUploadSucceeded) {
      unuploadedActivity.forEach((record) => remoteActivityIds.add(record.id));
    }
    acknowledgeSyncedRecords('activity_logs', remoteActivityIds);
    const mergedActivity = mergeRecordsById(
      localActivity.map((record) => ({ ...record, user_id: userId })),
      remoteActivity
    );
    saveLocalArray(STORAGE_KEYS.ACTIVITY, mergedActivity);

    // 4. Two-way Feel Sync
    const localFeel = getFeelLogs();
    const remoteFeel = (feelRes.data as FeelLog[]) || [];
    const remoteFeelIds = new Set(remoteFeel.map((r) => r.id));
    const unuploadedFeel = localFeel
      .filter((l) => !remoteFeelIds.has(l.id))
      .map((l) => ({ ...l, user_id: userId }));

    let feelUploadSucceeded = true;
    if (unuploadedFeel.length > 0) {
      const { error } = await supabase.from('feel_logs').upsert(unuploadedFeel);
      if (error) {
        feelUploadSucceeded = false;
        console.warn('Failed to upsert unuploaded feel logs:', error.message);
      }
    }
    if (feelUploadSucceeded) {
      unuploadedFeel.forEach((record) => remoteFeelIds.add(record.id));
    }
    acknowledgeSyncedRecords('feel_logs', remoteFeelIds);
    const mergedFeel = mergeRecordsById(
      localFeel.map((record) => ({ ...record, user_id: userId })),
      remoteFeel
    );
    saveLocalArray(STORAGE_KEYS.FEEL, mergedFeel);

    // 5. Two-way Glucose Sync
    const localGlucose = getGlucoseLogs();
    const remoteGlucose = (glucoseRes.data as GlucoseLog[]) || [];
    const remoteGlucoseIds = new Set(remoteGlucose.map((r) => r.id));
    const unuploadedGlucose = localGlucose
      .filter((l) => !remoteGlucoseIds.has(l.id))
      .map((l) => ({ ...l, user_id: userId }));

    let glucoseUploadSucceeded = true;
    if (unuploadedGlucose.length > 0) {
      const { error } = await supabase.from('glucose_logs').upsert(unuploadedGlucose);
      if (error) {
        glucoseUploadSucceeded = false;
        console.warn('Failed to upsert unuploaded glucose logs:', error.message);
      }
    }
    if (glucoseUploadSucceeded) {
      unuploadedGlucose.forEach((record) => remoteGlucoseIds.add(record.id));
    }
    acknowledgeSyncedRecords('glucose_logs', remoteGlucoseIds);
    const mergedGlucose = mergeRecordsById(
      localGlucose.map((record) => ({ ...record, user_id: userId })),
      remoteGlucose
    );
    saveLocalArray(STORAGE_KEYS.GLUCOSE, mergedGlucose);

    window.dispatchEvent(new CustomEvent('t1d-data-updated'));
    return true;
  } catch (err) {
    console.warn('Error hydrating from Supabase:', err);
    return false;
  }
}

// Hydrate local cache from Server Database / Supabase on load
export async function hydrateFromServerDatabase(): Promise<boolean> {
  if (typeof window === 'undefined' || !getIsOnline()) return false;

  // 1. First priority: hydrate from Supabase
  if (isSupabaseConfigured && supabase) {
    const supabaseHydrated = await hydrateFromSupabase();
    if (supabaseHydrated) return true;
  }

  if (isSupabaseConfigured) {
    return false;
  }

  // 2. Fallback to /api/logs
  try {
    const res = await fetch('/api/logs');
    if (!res.ok) return false;
    const json = await res.json();
    if (!json.success || !json.data) return false;

    const db = json.data;
    if (Array.isArray(db.insulin_logs) && db.insulin_logs.length > 0) {
      saveLocalArray(STORAGE_KEYS.INSULIN, mergeRecordsById(getInsulinLogs(), db.insulin_logs));
    }
    if (Array.isArray(db.food_logs) && db.food_logs.length > 0) {
      saveLocalArray(STORAGE_KEYS.FOOD, mergeRecordsById(getFoodLogs(), db.food_logs));
    }
    if (Array.isArray(db.activity_logs) && db.activity_logs.length > 0) {
      saveLocalArray(STORAGE_KEYS.ACTIVITY, mergeRecordsById(getActivityLogs(), db.activity_logs));
    }
    if (Array.isArray(db.feel_logs) && db.feel_logs.length > 0) {
      saveLocalArray(STORAGE_KEYS.FEEL, mergeRecordsById(getFeelLogs(), db.feel_logs));
    }
    if (Array.isArray(db.glucose_logs) && db.glucose_logs.length > 0) {
      saveLocalArray(STORAGE_KEYS.GLUCOSE, mergeRecordsById(getGlucoseLogs(), db.glucose_logs));
    }
    return true;
  } catch (err) {
    console.warn('Error hydrating from server database:', err);
    return false;
  }
}

// INSULIN LOGS
export function getInsulinLogs(): InsulinLog[] {
  return getLocalArray<InsulinLog>(STORAGE_KEYS.INSULIN);
}

export function saveInsulinLog(log: Omit<InsulinLog, 'id' | 'created_at'> & { id?: string }): InsulinLog {
  const existing = getInsulinLogs();
  const id = log.id || crypto.randomUUID();
  const userId = log.user_id && log.user_id !== 'user-1' ? log.user_id : getActiveUserId();
  const fullLog: InsulinLog = {
    ...log,
    id,
    user_id: userId,
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
  if (typeof window !== 'undefined' && getIsOnline()) {
    flushOfflineQueue().catch((error) => {
      console.warn('Failed to sync insulin log:', error);
    });
  }
  return fullLog;
}

export function deleteInsulinLog(id: string): void {
  const existing = getInsulinLogs().filter((item) => item.id !== id);
  saveLocalArray(STORAGE_KEYS.INSULIN, existing);
  addToQueue({ id, table: 'insulin_logs', action: 'delete', payload: null });
  if (typeof window !== 'undefined' && getIsOnline()) {
    flushOfflineQueue().catch((error) => {
      console.warn('Failed to sync insulin deletion:', error);
    });
  }
}

// FOOD LOGS
export function getFoodLogs(): FoodLog[] {
  return getLocalArray<FoodLog>(STORAGE_KEYS.FOOD);
}

export function saveFoodLog(log: Omit<FoodLog, 'id' | 'created_at'> & { id?: string }): FoodLog {
  const existing = getFoodLogs();
  const id = log.id || crypto.randomUUID();
  const userId = log.user_id && log.user_id !== 'user-1' ? log.user_id : getActiveUserId();
  const fullLog: FoodLog = {
    ...log,
    id,
    user_id: userId,
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
  if (typeof window !== 'undefined' && getIsOnline()) {
    flushOfflineQueue().catch((error) => {
      console.warn('Failed to sync food log:', error);
    });
  }
  return fullLog;
}

export function deleteFoodLog(id: string): void {
  const existing = getFoodLogs().filter((item) => item.id !== id);
  saveLocalArray(STORAGE_KEYS.FOOD, existing);
  addToQueue({ id, table: 'food_logs', action: 'delete', payload: null });
  if (typeof window !== 'undefined' && getIsOnline()) {
    flushOfflineQueue().catch((error) => {
      console.warn('Failed to sync food deletion:', error);
    });
  }
}

// ACTIVITY LOGS
export function getActivityLogs(): ActivityLog[] {
  return getLocalArray<ActivityLog>(STORAGE_KEYS.ACTIVITY);
}

export function saveActivityLog(log: Omit<ActivityLog, 'id' | 'created_at'> & { id?: string }): ActivityLog {
  const existing = getActivityLogs();
  const id = log.id || crypto.randomUUID();
  const userId = log.user_id && log.user_id !== 'user-1' ? log.user_id : getActiveUserId();
  const fullLog: ActivityLog = {
    ...log,
    id,
    user_id: userId,
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
  if (typeof window !== 'undefined' && getIsOnline()) {
    flushOfflineQueue().catch((error) => {
      console.warn('Failed to sync activity log:', error);
    });
  }
  return fullLog;
}

export function deleteActivityLog(id: string): void {
  const existing = getActivityLogs().filter((item) => item.id !== id);
  saveLocalArray(STORAGE_KEYS.ACTIVITY, existing);
  addToQueue({ id, table: 'activity_logs', action: 'delete', payload: null });
  if (typeof window !== 'undefined' && getIsOnline()) {
    flushOfflineQueue().catch((error) => {
      console.warn('Failed to sync activity deletion:', error);
    });
  }
}

// FEEL LOGS
export function getFeelLogs(): FeelLog[] {
  return getLocalArray<FeelLog>(STORAGE_KEYS.FEEL);
}

export function saveFeelLog(log: Omit<FeelLog, 'id' | 'created_at'> & { id?: string }): FeelLog {
  const existing = getFeelLogs();
  const id = log.id || crypto.randomUUID();
  const userId = log.user_id && log.user_id !== 'user-1' ? log.user_id : getActiveUserId();
  const fullLog: FeelLog = {
    ...log,
    id,
    user_id: userId,
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
  if (typeof window !== 'undefined' && getIsOnline()) {
    flushOfflineQueue().catch((error) => {
      console.warn('Failed to sync feel log:', error);
    });
  }
  return fullLog;
}

export function deleteFeelLog(id: string): void {
  const existing = getFeelLogs().filter((item) => item.id !== id);
  saveLocalArray(STORAGE_KEYS.FEEL, existing);
  addToQueue({ id, table: 'feel_logs', action: 'delete', payload: null });
  if (typeof window !== 'undefined' && getIsOnline()) {
    flushOfflineQueue().catch((error) => {
      console.warn('Failed to sync feel deletion:', error);
    });
  }
}

// GLUCOSE LOGS (Nullable/Optional everywhere)
export function getGlucoseLogs(): GlucoseLog[] {
  return getLocalArray<GlucoseLog>(STORAGE_KEYS.GLUCOSE);
}

export function saveGlucoseLog(log: Omit<GlucoseLog, 'id' | 'created_at'> & { id?: string }): GlucoseLog {
  const existing = getGlucoseLogs();
  const id = log.id || crypto.randomUUID();
  const userId = log.user_id && log.user_id !== 'user-1' ? log.user_id : getActiveUserId();
  const fullLog: GlucoseLog = {
    ...log,
    id,
    user_id: userId,
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
  if (typeof window !== 'undefined' && getIsOnline()) {
    flushOfflineQueue().catch((error) => {
      console.warn('Failed to sync glucose log:', error);
    });
  }
  return fullLog;
}

export function deleteGlucoseLog(id: string): void {
  const existing = getGlucoseLogs().filter((item) => item.id !== id);
  saveLocalArray(STORAGE_KEYS.GLUCOSE, existing);
  addToQueue({ id, table: 'glucose_logs', action: 'delete', payload: null });
  if (typeof window !== 'undefined' && getIsOnline()) {
    flushOfflineQueue().catch((error) => {
      console.warn('Failed to sync glucose deletion:', error);
    });
  }
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
    const breakfastItems = i % 2 === 0 ? '3 idly, sambar' : '2 dosa, coconut chutney';
    const breakfastCarbSize = 'medium' as const;
    const breakfastNutrients = estimateNutrientsFromItems(breakfastItems, breakfastCarbSize);
    foodList.push({
      id: crypto.randomUUID(),
      user_id: userId,
      log_date: dateStr,
      log_time: '08:15',
      meal: 'breakfast',
      items: breakfastItems,
      carb_size: breakfastCarbSize,
      note: 'PG mess breakfast',
      ...breakfastNutrients,
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
        const lateLunchItems = 'rice with dal, curd';
        const lateLunchCarb = 'large' as const;
        foodList.push({
          id: crypto.randomUUID(),
          user_id: userId,
          log_date: dateStr,
          log_time: '14:45',
          meal: 'lunch',
          items: lateLunchItems,
          carb_size: lateLunchCarb,
          note: 'Very late lunch after project meeting',
          ...estimateNutrientsFromItems(lateLunchItems, lateLunchCarb),
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
        ...estimateNutrientsFromItems(items, carbSize),
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
      const dinnerItems = 'chapathi with veg kurma, egg';
      const dinnerCarb = 'medium' as const;
      foodList.push({
        id: crypto.randomUUID(),
        user_id: userId,
        log_date: dateStr,
        log_time: '20:45',
        meal: 'dinner',
        items: dinnerItems,
        carb_size: dinnerCarb,
        note: 'PG dinner',
        ...estimateNutrientsFromItems(dinnerItems, dinnerCarb),
      });
    }
  }

  saveLocalArray(STORAGE_KEYS.INSULIN, insulinList);
  saveLocalArray(STORAGE_KEYS.FOOD, foodList);
  saveLocalArray(STORAGE_KEYS.ACTIVITY, activityList);
  saveLocalArray(STORAGE_KEYS.FEEL, feelList);
  saveLocalArray(STORAGE_KEYS.GLUCOSE, glucoseList);
}
