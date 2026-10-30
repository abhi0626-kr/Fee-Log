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
  DELETED_IDS: 't1d_deleted_ids',
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
  daily_max_sugar_g: 25,
  daily_max_sodium_mg: 2300,
  daily_target_calories: 2000,
  gemini_api_key: '',
  openai_api_key: '',

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

const memoryLogs = {
  insulin: [] as InsulinLog[],
  food: [] as FoodLog[],
  activity: [] as ActivityLog[],
  feel: [] as FeelLog[],
  glucose: [] as GlucoseLog[],
};

type LogTable = SyncQueueItem['table'];

function notifyDataUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('t1d-data-updated'));
  }
}

async function getRequiredUserId(): Promise<string> {
  const userId = await getCloudAuthUserId();
  if (!userId) {
    throw new Error('You must be signed in to save logs to the database.');
  }
  return userId;
}

async function upsertLog<T extends { id: string; user_id: string }>(
  table: LogTable,
  log: T
): Promise<T> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.');
  }
  const userId = await getRequiredUserId();
  const record = { ...log, user_id: userId };
  let { error } = await supabase.from(table).upsert(record);
  if (error && table === 'food_logs' && isMissingColumnError(error)) {
    const baseRecord = sanitizeFoodPayload(record as Record<string, unknown>);
    const retryResult = await supabase.from(table).upsert(baseRecord);
    error = retryResult.error;
  }
  if (error) {
    throw new Error(`Failed to save ${table}: ${error.message}`);
  }
  return record;
}

async function deleteLog(table: LogTable, id: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.');
  }
  const userId = await getRequiredUserId();
  const { error } = await supabase.from(table).delete().eq('id', id).eq('user_id', userId);
  if (error) {
    throw new Error(`Failed to delete ${table}: ${error.message}`);
  }
}

function withDatabaseTimeout<T>(operation: Promise<T>, timeoutMs = 12000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Database request timed out.'));
    }, timeoutMs);
    operation.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

async function persistLogDirectly<T extends { id: string; user_id: string }>(
  table: LogTable,
  log: T,
  action: 'insert' | 'update'
): Promise<void> {
  try {
    const saved = await withDatabaseTimeout(upsertLog(table, log));
    const current = getLocalArray<T>(table);
    const savedIndex = current.findIndex((item) => item.id === saved.id);
    if (savedIndex >= 0) current[savedIndex] = saved;
    saveLocalArray(table, current);
    acknowledgeUploadedRecords(table, new Set([saved.id]));
  } catch (error) {
    addToQueue({ id: log.id, table, action, payload: log });
    console.error(`Unable to save ${table} directly; queued for retry:`, error);
  }
}

async function deleteLogDirectly(table: LogTable, id: string): Promise<void> {
  try {
    await withDatabaseTimeout(deleteLog(table, id));
    removeDeleteFromQueue(table, id);
  } catch (error) {
    addToQueue({ id, table, action: 'delete', payload: { id } });
    console.error(`Unable to delete ${table} directly; queued for retry:`, error);
  }
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
  const memoryKey =
    key === STORAGE_KEYS.INSULIN ? 'insulin' :
    key === STORAGE_KEYS.FOOD ? 'food' :
    key === STORAGE_KEYS.ACTIVITY ? 'activity' :
    key === STORAGE_KEYS.FEEL ? 'feel' :
    key === STORAGE_KEYS.GLUCOSE ? 'glucose' :
    null;

  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          if (memoryKey === 'insulin') memoryLogs.insulin = parsed as InsulinLog[];
          else if (memoryKey === 'food') memoryLogs.food = parsed as FoodLog[];
          else if (memoryKey === 'activity') memoryLogs.activity = parsed as ActivityLog[];
          else if (memoryKey === 'feel') memoryLogs.feel = parsed as FeelLog[];
          else if (memoryKey === 'glucose') memoryLogs.glucose = parsed as GlucoseLog[];
          return parsed as T[];
        }
      }
    } catch (error) {
      console.warn(`Unable to read local storage key ${key}:`, error);
    }
  }

  if (memoryKey) return memoryLogs[memoryKey] as T[];
  return [];
}

function saveLocalArray<T>(key: string, items: T[]): void {
  if (key === STORAGE_KEYS.INSULIN) memoryLogs.insulin = items as InsulinLog[];
  else if (key === STORAGE_KEYS.FOOD) memoryLogs.food = items as FoodLog[];
  else if (key === STORAGE_KEYS.ACTIVITY) memoryLogs.activity = items as ActivityLog[];
  else if (key === STORAGE_KEYS.FEEL) memoryLogs.feel = items as FeelLog[];
  else if (key === STORAGE_KEYS.GLUCOSE) memoryLogs.glucose = items as GlucoseLog[];
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(key, JSON.stringify(items));
    } catch (error) {
      console.error(`Unable to persist local storage key ${key}:`, error);
    }
  }
  notifyDataUpdated();
}

// Helper to merge local and remote arrays without duplicates
export function mergeRecordsById<T extends { id: string }>(
  existing: T[],
  incoming: T[],
  pendingUpdateIds?: Set<string>
): T[] {
  const map = new Map<string, T>();
  existing.forEach((item) => map.set(item.id, item));
  incoming.forEach((item) => {
    // If the local item has a pending update in the offline queue, DO NOT overwrite it with stale remote data!
    if (pendingUpdateIds && pendingUpdateIds.has(item.id)) {
      return;
    }
    map.set(item.id, item);
  });
  return Array.from(map.values());
}

// Helper to preserve locally stored macros if the remote Supabase table lacks them
export function mergeFoodRecords(
  existing: FoodLog[],
  incoming: FoodLog[],
  pendingUpdateIds?: Set<string>
): FoodLog[] {
  const map = new Map<string, FoodLog>();
  existing.forEach((item) => map.set(item.id, item));
  incoming.forEach((remote) => {
    const local = map.get(remote.id);
    if (local) {
      if (pendingUpdateIds && pendingUpdateIds.has(remote.id)) {
        // Local has pending changes that shouldn't be overwritten by stale remote data
        return;
      }
      map.set(remote.id, {
        ...remote,
        carbs_g: remote.carbs_g ?? local.carbs_g,
        protein_g: remote.protein_g ?? local.protein_g,
        fiber_g: remote.fiber_g ?? local.fiber_g,
        sugar_g: remote.sugar_g ?? local.sugar_g,
        sodium_mg: remote.sodium_mg ?? local.sodium_mg,
        calories: remote.calories ?? local.calories,
      });
    } else {
      map.set(remote.id, remote);
    }
  });
  return Array.from(map.values());
}

function sanitizeFoodPayload<T extends Record<string, unknown>>(payload: T): Record<string, unknown> {
  const base = { ...payload };
  delete base.carbs_g;
  delete base.protein_g;
  delete base.fiber_g;
  delete base.sugar_g;
  delete base.sodium_mg;
  delete base.calories;
  return base;
}

function isMissingColumnError(error?: { message?: string; details?: string; code?: string } | null): boolean {
  if (!error) return false;
  if (error.code === 'PGRST204' || error.code === '42703') return true;
  const msg = `${error.message || ''} ${error.details || ''}`.toLowerCase();
  return (
    msg.includes('column') ||
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    msg.includes('could not find')
  );
}

// Deletion Tombstone Tracking
export interface DeletedIdRecord {
  table: SyncQueueItem['table'];
  deletedAt: string;
}

export function getDeletedIdsMap(): Record<string, DeletedIdRecord> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DELETED_IDS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function markIdAsDeleted(id: string, table: SyncQueueItem['table']): void {
  if (typeof window === 'undefined') return;
  try {
    const map = getDeletedIdsMap();
    map[id] = { table, deletedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEYS.DELETED_IDS, JSON.stringify(map));
  } catch (err) {
    console.error('Failed to mark ID as deleted:', err);
  }
}

export function isIdDeleted(id: string): boolean {
  const map = getDeletedIdsMap();
  return Boolean(map[id]);
}

export async function executeDirectDelete(
  table: SyncQueueItem['table'],
  id: string
): Promise<boolean> {
  if (typeof window === 'undefined' || !getIsOnline() || !isSupabaseConfigured || !supabase) {
    return false;
  }
  try {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) {
      console.warn(`Direct delete failed for ${table}/${id}:`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`Direct delete network failure for ${table}/${id}:`, err);
    return false;
  }
}

function removeDeleteFromQueue(table: SyncQueueItem['table'], id: string): void {
  const queue = getOfflineQueue();
  const remaining = queue.filter(
    (item) => !(item.table === table && item.id === id && item.action === 'delete')
  );
  if (remaining.length !== queue.length) {
    saveLocalArray(STORAGE_KEYS.QUEUE, remaining);
  }
}

function acknowledgeUploadedRecords(table: SyncQueueItem['table'], uploadedIds: Set<string>): void {
  if (uploadedIds.size === 0) return;
  const queue = getOfflineQueue();
  const remaining = queue.filter(
    (item) => !(item.table === table && item.action !== 'delete' && uploadedIds.has(item.id))
  );
  if (remaining.length !== queue.length) {
    saveLocalArray(STORAGE_KEYS.QUEUE, remaining);
  }
}

function acknowledgeSyncedInserts(table: SyncQueueItem['table'], remoteIds: Set<string>): void {
  if (remoteIds.size === 0) return;
  const queue = getOfflineQueue();
  // Only acknowledge 'insert' actions when confirmed present on server.
  // Never acknowledge 'update' just because ID is in remoteIds (it might be stale on server).
  const remaining = queue.filter(
    (item) => !(item.table === table && item.action === 'insert' && remoteIds.has(item.id))
  );
  if (remaining.length !== queue.length) {
    saveLocalArray(STORAGE_KEYS.QUEUE, remaining);
  }
}

function acknowledgeDeletedRecords(table: SyncQueueItem['table'], remoteIds: Set<string>): void {
  const queue = getOfflineQueue();
  // Acknowledge delete actions when the server confirmed no longer has the record
  const remaining = queue.filter(
    (item) => !(item.table === table && item.action === 'delete' && !remoteIds.has(item.id))
  );
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
  const timestamp = new Date().toISOString();

  if (item.action === 'delete') {
    // If deleted, remove any pending insert/update for this id, and add delete
    const filtered = queue.filter(
      (q) => !(q.table === item.table && q.id === item.id)
    );
    filtered.push({ ...item, timestamp });
    saveLocalArray(STORAGE_KEYS.QUEUE, filtered);
    return;
  }

  // Deduplicate pending inserts and updates for the same record
  const existingIdx = queue.findIndex(
    (q) => q.table === item.table && q.id === item.id
  );
  if (existingIdx >= 0) {
    const existing = queue[existingIdx];
    if (existing.action === 'insert') {
      // Keep action as 'insert' but update payload with newest edits
      queue[existingIdx] = {
        ...existing,
        payload: item.payload,
        timestamp,
      };
    } else {
      // Existing was update; replace with newest update payload
      queue[existingIdx] = {
        ...item,
        timestamp,
      };
    }
  } else {
    queue.push({
      ...item,
      timestamp,
    });
  }
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
          let { error } = await supabase.from(item.table).upsert([payload]);
          if (error && item.table === 'food_logs' && isMissingColumnError(error)) {
            const basePayload = sanitizeFoodPayload(payload);
            const retryRes = await supabase.from(item.table).upsert([basePayload]);
            error = retryRes.error;
          }
          if (error) throw error;
          synced++;
        } else if (item.action === 'delete') {
          const { error } = await supabase
            .from(item.table)
            .delete()
            .eq('id', item.id);
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

let pendingReFlush = false;

export function flushOfflineQueue(): Promise<SyncResult> {
  if (flushPromise) {
    pendingReFlush = true;
    return flushPromise;
  }
  flushPromise = flushOfflineQueueInternal().finally(() => {
    flushPromise = null;
    if (pendingReFlush) {
      pendingReFlush = false;
      flushOfflineQueue().catch(() => {});
    }
  });
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

    const deletedMap = getDeletedIdsMap();
    const queue = getOfflineQueue();
    let anyHydrated = false;

    // 1. Two-way Insulin Sync
    if (!insulinRes.error && Array.isArray(insulinRes.data)) {
      try {
        const rawRemoteInsulin = (insulinRes.data as InsulinLog[]) || [];
        for (const r of rawRemoteInsulin) {
          if (deletedMap[r.id]) {
            executeDirectDelete('insulin_logs', r.id);
          }
        }
        const remoteInsulin = rawRemoteInsulin.filter((r) => !deletedMap[r.id]);
        const remoteInsulinIds = new Set(remoteInsulin.map((r) => r.id));
        const localInsulin = getInsulinLogs().filter((l) => !deletedMap[l.id]);

        const pendingInsulinIds = new Set(
          queue
            .filter((q) => q.table === 'insulin_logs' && (q.action === 'insert' || q.action === 'update'))
            .map((q) => q.id)
        );

        const unuploadedInsulin = localInsulin
          .filter((l) => pendingInsulinIds.has(l.id) || !remoteInsulinIds.has(l.id) || !l.user_id || l.user_id !== userId)
          .map((l) => ({ ...l, user_id: userId }));

        let insulinUploadSucceeded = true;
        if (unuploadedInsulin.length > 0) {
          const { error } = await supabase.from('insulin_logs').upsert(unuploadedInsulin);
          if (error) {
            insulinUploadSucceeded = false;
            console.warn('Failed to upsert unuploaded insulin logs:', error.message);
          }
        }
        if (insulinUploadSucceeded && unuploadedInsulin.length > 0) {
          unuploadedInsulin.forEach((record) => remoteInsulinIds.add(record.id));
          acknowledgeUploadedRecords('insulin_logs', new Set(unuploadedInsulin.map((r) => r.id)));
        }
        acknowledgeSyncedInserts('insulin_logs', remoteInsulinIds);
        acknowledgeDeletedRecords('insulin_logs', remoteInsulinIds);
        const mergedInsulin = mergeRecordsById(
          localInsulin.map((record) => ({ ...record, user_id: userId })),
          remoteInsulin,
          pendingInsulinIds
        ).filter((r) => !deletedMap[r.id]);
        saveLocalArray(STORAGE_KEYS.INSULIN, mergedInsulin);
        anyHydrated = true;
      } catch (e) {
        console.warn('Error during insulin hydration:', e);
      }
    } else if (insulinRes.error) {
      console.warn('Supabase insulin query notice:', insulinRes.error.message);
    }

    // 2. Two-way Food Sync
    if (!foodRes.error && Array.isArray(foodRes.data)) {
      try {
        const rawRemoteFood = (foodRes.data as FoodLog[]) || [];
        for (const r of rawRemoteFood) {
          if (deletedMap[r.id]) {
            executeDirectDelete('food_logs', r.id);
          }
        }
        const remoteFood = rawRemoteFood.filter((r) => !deletedMap[r.id]);
        const remoteFoodIds = new Set(remoteFood.map((r) => r.id));
        const localFood = getFoodLogs().filter((l) => !deletedMap[l.id]);

        const pendingFoodIds = new Set(
          queue
            .filter((q) => q.table === 'food_logs' && (q.action === 'insert' || q.action === 'update'))
            .map((q) => q.id)
        );

        const unuploadedFood = localFood
          .filter((l) => pendingFoodIds.has(l.id) || !remoteFoodIds.has(l.id) || !l.user_id || l.user_id !== userId)
          .map((l) => ({ ...l, user_id: userId }));

        let foodUploadSucceeded = true;
        if (unuploadedFood.length > 0) {
          let { error } = await supabase.from('food_logs').upsert(unuploadedFood);
          if (error && isMissingColumnError(error)) {
            const baseFoodLogs = unuploadedFood.map(sanitizeFoodPayload);
            const retryRes = await supabase.from('food_logs').upsert(baseFoodLogs);
            error = retryRes.error;
          }
          if (error) {
            foodUploadSucceeded = false;
            console.warn('Failed to upsert unuploaded food logs:', error.message);
          }
        }
        if (foodUploadSucceeded && unuploadedFood.length > 0) {
          unuploadedFood.forEach((record) => remoteFoodIds.add(record.id));
          acknowledgeUploadedRecords('food_logs', new Set(unuploadedFood.map((r) => r.id)));
        }
        acknowledgeSyncedInserts('food_logs', remoteFoodIds);
        acknowledgeDeletedRecords('food_logs', remoteFoodIds);
        const mergedFood = mergeFoodRecords(
          localFood.map((record) => ({ ...record, user_id: userId })),
          remoteFood,
          pendingFoodIds
        ).filter((r) => !deletedMap[r.id]);
        saveLocalArray(STORAGE_KEYS.FOOD, mergedFood);
        anyHydrated = true;
      } catch (e) {
        console.warn('Error during food hydration:', e);
      }
    } else if (foodRes.error) {
      console.warn('Supabase food query notice:', foodRes.error.message);
    }

    // 3. Two-way Activity Sync
    if (!activityRes.error && Array.isArray(activityRes.data)) {
      try {
        const rawRemoteActivity = (activityRes.data as ActivityLog[]) || [];
        for (const r of rawRemoteActivity) {
          if (deletedMap[r.id]) {
            executeDirectDelete('activity_logs', r.id);
          }
        }
        const remoteActivity = rawRemoteActivity.filter((r) => !deletedMap[r.id]);
        const remoteActivityIds = new Set(remoteActivity.map((r) => r.id));
        const localActivity = getActivityLogs().filter((l) => !deletedMap[l.id]);

        const pendingActivityIds = new Set(
          queue
            .filter((q) => q.table === 'activity_logs' && (q.action === 'insert' || q.action === 'update'))
            .map((q) => q.id)
        );

        const unuploadedActivity = localActivity
          .filter((l) => pendingActivityIds.has(l.id) || !remoteActivityIds.has(l.id) || !l.user_id || l.user_id !== userId)
          .map((l) => ({ ...l, user_id: userId }));

        let activityUploadSucceeded = true;
        if (unuploadedActivity.length > 0) {
          const { error } = await supabase.from('activity_logs').upsert(unuploadedActivity);
          if (error) {
            activityUploadSucceeded = false;
            console.warn('Failed to upsert unuploaded activity logs:', error.message);
          }
        }
        if (activityUploadSucceeded && unuploadedActivity.length > 0) {
          unuploadedActivity.forEach((record) => remoteActivityIds.add(record.id));
          acknowledgeUploadedRecords('activity_logs', new Set(unuploadedActivity.map((r) => r.id)));
        }
        acknowledgeSyncedInserts('activity_logs', remoteActivityIds);
        acknowledgeDeletedRecords('activity_logs', remoteActivityIds);
        const mergedActivity = mergeRecordsById(
          localActivity.map((record) => ({ ...record, user_id: userId })),
          remoteActivity,
          pendingActivityIds
        ).filter((r) => !deletedMap[r.id]);
        saveLocalArray(STORAGE_KEYS.ACTIVITY, mergedActivity);
        anyHydrated = true;
      } catch (e) {
        console.warn('Error during activity hydration:', e);
      }
    } else if (activityRes.error) {
      console.warn('Supabase activity query notice:', activityRes.error.message);
    }

    // 4. Two-way Feel Sync
    if (!feelRes.error && Array.isArray(feelRes.data)) {
      try {
        const rawRemoteFeel = (feelRes.data as FeelLog[]) || [];
        for (const r of rawRemoteFeel) {
          if (deletedMap[r.id]) {
            executeDirectDelete('feel_logs', r.id);
          }
        }
        const remoteFeel = rawRemoteFeel.filter((r) => !deletedMap[r.id]);
        const remoteFeelIds = new Set(remoteFeel.map((r) => r.id));
        const localFeel = getFeelLogs().filter((l) => !deletedMap[l.id]);

        const pendingFeelIds = new Set(
          queue
            .filter((q) => q.table === 'feel_logs' && (q.action === 'insert' || q.action === 'update'))
            .map((q) => q.id)
        );

        const unuploadedFeel = localFeel
          .filter((l) => pendingFeelIds.has(l.id) || !remoteFeelIds.has(l.id) || !l.user_id || l.user_id !== userId)
          .map((l) => ({ ...l, user_id: userId }));

        let feelUploadSucceeded = true;
        if (unuploadedFeel.length > 0) {
          const { error } = await supabase.from('feel_logs').upsert(unuploadedFeel);
          if (error) {
            feelUploadSucceeded = false;
            console.warn('Failed to upsert unuploaded feel logs:', error.message);
          }
        }
        if (feelUploadSucceeded && unuploadedFeel.length > 0) {
          unuploadedFeel.forEach((record) => remoteFeelIds.add(record.id));
          acknowledgeUploadedRecords('feel_logs', new Set(unuploadedFeel.map((r) => r.id)));
        }
        acknowledgeSyncedInserts('feel_logs', remoteFeelIds);
        acknowledgeDeletedRecords('feel_logs', remoteFeelIds);
        const mergedFeel = mergeRecordsById(
          localFeel.map((record) => ({ ...record, user_id: userId })),
          remoteFeel,
          pendingFeelIds
        ).filter((r) => !deletedMap[r.id]);
        saveLocalArray(STORAGE_KEYS.FEEL, mergedFeel);
        anyHydrated = true;
      } catch (e) {
        console.warn('Error during feel hydration:', e);
      }
    } else if (feelRes.error) {
      console.warn('Supabase feel query notice:', feelRes.error.message);
    }

    // 5. Two-way Glucose Sync
    if (!glucoseRes.error && Array.isArray(glucoseRes.data)) {
      try {
        const rawRemoteGlucose = (glucoseRes.data as GlucoseLog[]) || [];
        for (const r of rawRemoteGlucose) {
          if (deletedMap[r.id]) {
            executeDirectDelete('glucose_logs', r.id);
          }
        }
        const remoteGlucose = rawRemoteGlucose.filter((r) => !deletedMap[r.id]);
        const remoteGlucoseIds = new Set(remoteGlucose.map((r) => r.id));
        const localGlucose = getGlucoseLogs().filter((l) => !deletedMap[l.id]);

        const pendingGlucoseIds = new Set(
          queue
            .filter((q) => q.table === 'glucose_logs' && (q.action === 'insert' || q.action === 'update'))
            .map((q) => q.id)
        );

        const unuploadedGlucose = localGlucose
          .filter((l) => pendingGlucoseIds.has(l.id) || !remoteGlucoseIds.has(l.id) || !l.user_id || l.user_id !== userId)
          .map((l) => ({ ...l, user_id: userId }));

        let glucoseUploadSucceeded = true;
        if (unuploadedGlucose.length > 0) {
          const { error } = await supabase.from('glucose_logs').upsert(unuploadedGlucose);
          if (error) {
            glucoseUploadSucceeded = false;
            console.warn('Failed to upsert unuploaded glucose logs:', error.message);
          }
        }
        if (glucoseUploadSucceeded && unuploadedGlucose.length > 0) {
          unuploadedGlucose.forEach((record) => remoteGlucoseIds.add(record.id));
          acknowledgeUploadedRecords('glucose_logs', new Set(unuploadedGlucose.map((r) => r.id)));
        }
        acknowledgeSyncedInserts('glucose_logs', remoteGlucoseIds);
        acknowledgeDeletedRecords('glucose_logs', remoteGlucoseIds);
        const mergedGlucose = mergeRecordsById(
          localGlucose.map((record) => ({ ...record, user_id: userId })),
          remoteGlucose,
          pendingGlucoseIds
        ).filter((r) => !deletedMap[r.id]);
        saveLocalArray(STORAGE_KEYS.GLUCOSE, mergedGlucose);
        anyHydrated = true;
      } catch (e) {
        console.warn('Error during glucose hydration:', e);
      }
    } else if (glucoseRes.error) {
      console.warn('Supabase glucose query notice:', glucoseRes.error.message);
    }

    window.dispatchEvent(new CustomEvent('t1d-data-updated'));
    return anyHydrated;
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
    const queue = getOfflineQueue();
    const pendingInsulinIds = new Set(queue.filter((q) => q.table === 'insulin_logs').map((q) => q.id));
    const pendingFoodIds = new Set(queue.filter((q) => q.table === 'food_logs').map((q) => q.id));
    const pendingActivityIds = new Set(queue.filter((q) => q.table === 'activity_logs').map((q) => q.id));
    const pendingFeelIds = new Set(queue.filter((q) => q.table === 'feel_logs').map((q) => q.id));
    const pendingGlucoseIds = new Set(queue.filter((q) => q.table === 'glucose_logs').map((q) => q.id));

    if (Array.isArray(db.insulin_logs) && db.insulin_logs.length > 0) {
      saveLocalArray(STORAGE_KEYS.INSULIN, mergeRecordsById(getInsulinLogs(), db.insulin_logs, pendingInsulinIds));
    }
    if (Array.isArray(db.food_logs) && db.food_logs.length > 0) {
      saveLocalArray(STORAGE_KEYS.FOOD, mergeFoodRecords(getFoodLogs(), db.food_logs, pendingFoodIds));
    }
    if (Array.isArray(db.activity_logs) && db.activity_logs.length > 0) {
      saveLocalArray(STORAGE_KEYS.ACTIVITY, mergeRecordsById(getActivityLogs(), db.activity_logs, pendingActivityIds));
    }
    if (Array.isArray(db.feel_logs) && db.feel_logs.length > 0) {
      saveLocalArray(STORAGE_KEYS.FEEL, mergeRecordsById(getFeelLogs(), db.feel_logs, pendingFeelIds));
    }
    if (Array.isArray(db.glucose_logs) && db.glucose_logs.length > 0) {
      saveLocalArray(STORAGE_KEYS.GLUCOSE, mergeRecordsById(getGlucoseLogs(), db.glucose_logs, pendingGlucoseIds));
    }
    return true;
  } catch (err) {
    console.warn('Error hydrating from server database:', err);
    return false;
  }
}

// REALTIME SUPABASE CHANGE SUBSCRIPTION
// Listens for instant cross-device updates across insulin, food, feel, activity, and glucose logs
let realtimeChannel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;

export function initSupabaseRealtime(userId?: string): () => void {
  if (typeof window === 'undefined' || !isSupabaseConfigured || !supabase) {
    return () => {};
  }

  // Avoid duplicate channels
  if (realtimeChannel) {
    try {
      supabase.removeChannel(realtimeChannel);
    } catch {
      // ignore
    }
    realtimeChannel = null;
  }

  try {
    const channelName = `t1d-sync-live-${userId || 'active'}-${Date.now()}`;
    const handleRemoteChange = () => {
      hydrateFromSupabase(userId).catch(() => {});
    };

    realtimeChannel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'insulin_logs' }, handleRemoteChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'food_logs' }, handleRemoteChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_logs' }, handleRemoteChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feel_logs' }, handleRemoteChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'glucose_logs' }, handleRemoteChange)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('T1D Realtime live sync active on Supabase');
        }
      });

    return () => {
      if (realtimeChannel && supabase) {
        supabase.removeChannel(realtimeChannel);
        realtimeChannel = null;
      }
    };
  } catch (err) {
    console.warn('Realtime subscription init error:', err);
    return () => {};
  }
}

// INSULIN LOGS
export function getInsulinLogs(): InsulinLog[] {
  return getLocalArray<InsulinLog>(STORAGE_KEYS.INSULIN);
}

export function saveInsulinLog(
  log: Omit<InsulinLog, 'id' | 'created_at' | 'user_id'> & { id?: string; user_id?: string }
): InsulinLog {
  const existing = getInsulinLogs();
  const id = log.id || crypto.randomUUID();
  const userId = log.user_id && log.user_id !== 'user-1' ? log.user_id : getActiveUserId();
  const index = existing.findIndex((item) => item.id === id);
  const existingCreatedAt = index >= 0 ? existing[index].created_at : undefined;
  const fullLog: InsulinLog = {
    ...log,
    id,
    user_id: userId,
    created_at: existingCreatedAt || new Date().toISOString(),
  };

  if (index >= 0) existing[index] = fullLog;
  else existing.push(fullLog);
  saveLocalArray(STORAGE_KEYS.INSULIN, existing);
  addToQueue({ id, table: 'insulin_logs', action: index >= 0 ? 'update' : 'insert', payload: fullLog });
  void persistLogDirectly('insulin_logs', fullLog, index >= 0 ? 'update' : 'insert');
  return fullLog;
}

export function deleteInsulinLog(id: string): void {
  const existing = getInsulinLogs().filter((item) => item.id !== id);
  saveLocalArray(STORAGE_KEYS.INSULIN, existing);
  markIdAsDeleted(id, 'insulin_logs');
  addToQueue({ id, table: 'insulin_logs', action: 'delete', payload: { id } });
  void deleteLogDirectly('insulin_logs', id);
}

// FOOD LOGS
export function getFoodLogs(): FoodLog[] {
  return getLocalArray<FoodLog>(STORAGE_KEYS.FOOD);
}

export function saveFoodLog(
  log: Omit<FoodLog, 'id' | 'created_at' | 'user_id'> & { id?: string; user_id?: string }
): FoodLog {
  const existing = getFoodLogs();
  const id = log.id || crypto.randomUUID();
  const userId = log.user_id && log.user_id !== 'user-1' ? log.user_id : getActiveUserId();
  const index = existing.findIndex((item) => item.id === id);
  const existingCreatedAt = index >= 0 ? existing[index].created_at : undefined;
  const fullLog: FoodLog = {
    ...log,
    id,
    user_id: userId,
    created_at: existingCreatedAt || new Date().toISOString(),
  };

  if (index >= 0) existing[index] = fullLog;
  else existing.push(fullLog);
  saveLocalArray(STORAGE_KEYS.FOOD, existing);
  addToQueue({ id, table: 'food_logs', action: index >= 0 ? 'update' : 'insert', payload: fullLog });
  void persistLogDirectly('food_logs', fullLog, index >= 0 ? 'update' : 'insert');
  return fullLog;
}

export function deleteFoodLog(id: string): void {
  const existing = getFoodLogs().filter((item) => item.id !== id);
  saveLocalArray(STORAGE_KEYS.FOOD, existing);
  markIdAsDeleted(id, 'food_logs');
  addToQueue({ id, table: 'food_logs', action: 'delete', payload: { id } });
  void deleteLogDirectly('food_logs', id);
}

// ACTIVITY LOGS
export function getActivityLogs(): ActivityLog[] {
  return getLocalArray<ActivityLog>(STORAGE_KEYS.ACTIVITY);
}

export function saveActivityLog(
  log: Omit<ActivityLog, 'id' | 'created_at' | 'user_id'> & { id?: string; user_id?: string }
): ActivityLog {
  const existing = getActivityLogs();
  const id = log.id || crypto.randomUUID();
  const userId = log.user_id && log.user_id !== 'user-1' ? log.user_id : getActiveUserId();
  const index = existing.findIndex((item) => item.id === id);
  const existingCreatedAt = index >= 0 ? existing[index].created_at : undefined;
  const fullLog: ActivityLog = {
    ...log,
    id,
    user_id: userId,
    created_at: existingCreatedAt || new Date().toISOString(),
  };

  if (index >= 0) existing[index] = fullLog;
  else existing.push(fullLog);
  saveLocalArray(STORAGE_KEYS.ACTIVITY, existing);
  addToQueue({ id, table: 'activity_logs', action: index >= 0 ? 'update' : 'insert', payload: fullLog });
  void persistLogDirectly('activity_logs', fullLog, index >= 0 ? 'update' : 'insert');
  return fullLog;
}

export function deleteActivityLog(id: string): void {
  const existing = getActivityLogs().filter((item) => item.id !== id);
  saveLocalArray(STORAGE_KEYS.ACTIVITY, existing);
  markIdAsDeleted(id, 'activity_logs');
  addToQueue({ id, table: 'activity_logs', action: 'delete', payload: { id } });
  void deleteLogDirectly('activity_logs', id);
}

// FEEL LOGS
export function getFeelLogs(): FeelLog[] {
  return getLocalArray<FeelLog>(STORAGE_KEYS.FEEL);
}

export function saveFeelLog(
  log: Omit<FeelLog, 'id' | 'created_at' | 'user_id'> & { id?: string; user_id?: string }
): FeelLog {
  const existing = getFeelLogs();
  const id = log.id || crypto.randomUUID();
  const userId = log.user_id && log.user_id !== 'user-1' ? log.user_id : getActiveUserId();
  const index = existing.findIndex((item) => item.id === id);
  const existingCreatedAt = index >= 0 ? existing[index].created_at : undefined;
  const fullLog: FeelLog = {
    ...log,
    id,
    user_id: userId,
    created_at: existingCreatedAt || new Date().toISOString(),
  };

  if (index >= 0) existing[index] = fullLog;
  else existing.push(fullLog);
  saveLocalArray(STORAGE_KEYS.FEEL, existing);
  addToQueue({ id, table: 'feel_logs', action: index >= 0 ? 'update' : 'insert', payload: fullLog });
  void persistLogDirectly('feel_logs', fullLog, index >= 0 ? 'update' : 'insert');
  return fullLog;
}

export function deleteFeelLog(id: string): void {
  const existing = getFeelLogs().filter((item) => item.id !== id);
  saveLocalArray(STORAGE_KEYS.FEEL, existing);
  markIdAsDeleted(id, 'feel_logs');
  addToQueue({ id, table: 'feel_logs', action: 'delete', payload: { id } });
  void deleteLogDirectly('feel_logs', id);
}

// GLUCOSE LOGS (Nullable/Optional everywhere)
export function getGlucoseLogs(): GlucoseLog[] {
  return getLocalArray<GlucoseLog>(STORAGE_KEYS.GLUCOSE);
}

export function saveGlucoseLog(
  log: Omit<GlucoseLog, 'id' | 'created_at' | 'user_id'> & { id?: string; user_id?: string }
): GlucoseLog {
  const existing = getGlucoseLogs();
  const id = log.id || crypto.randomUUID();
  const userId = log.user_id && log.user_id !== 'user-1' ? log.user_id : getActiveUserId();
  const index = existing.findIndex((item) => item.id === id);
  const existingCreatedAt = index >= 0 ? existing[index].created_at : undefined;
  const fullLog: GlucoseLog = {
    ...log,
    id,
    user_id: userId,
    created_at: existingCreatedAt || new Date().toISOString(),
  };

  if (index >= 0) existing[index] = fullLog;
  else existing.push(fullLog);
  saveLocalArray(STORAGE_KEYS.GLUCOSE, existing);
  addToQueue({ id, table: 'glucose_logs', action: index >= 0 ? 'update' : 'insert', payload: fullLog });
  void persistLogDirectly('glucose_logs', fullLog, index >= 0 ? 'update' : 'insert');
  return fullLog;
}

export function deleteGlucoseLog(id: string): void {
  const existing = getGlucoseLogs().filter((item) => item.id !== id);
  saveLocalArray(STORAGE_KEYS.GLUCOSE, existing);
  markIdAsDeleted(id, 'glucose_logs');
  addToQueue({ id, table: 'glucose_logs', action: 'delete', payload: { id } });
  void deleteLogDirectly('glucose_logs', id);
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

export interface DeduplicateResult {
  insulin: number;
  food: number;
  activity: number;
  feel: number;
  glucose: number;
  total: number;
}

// Clean duplicate logs across local storage and cloud database
export function deduplicateLogs(): DeduplicateResult {
  const result: DeduplicateResult = {
    insulin: 0,
    food: 0,
    activity: 0,
    feel: 0,
    glucose: 0,
    total: 0,
  };

  // 1. Food duplicate resolution (same date, time, meal, and items)
  const foods = getFoodLogs();
  const seenFood = new Map<string, FoodLog>();
  const duplicateFoodIds: string[] = [];
  for (const f of foods) {
    const key = `${f.log_date}_${f.log_time}_${f.meal}_${(f.items || '').trim().toLowerCase()}`;
    if (seenFood.has(key)) {
      duplicateFoodIds.push(f.id);
    } else {
      seenFood.set(key, f);
    }
  }
  for (const id of duplicateFoodIds) {
    deleteFoodLog(id);
    result.food++;
  }

  // 2. Insulin duplicate resolution (same date, time, insulin_type, and units)
  const insulins = getInsulinLogs();
  const seenInsulin = new Map<string, InsulinLog>();
  const duplicateInsulinIds: string[] = [];
  for (const ins of insulins) {
    const key = `${ins.log_date}_${ins.log_time}_${ins.insulin_type}_${ins.units}`;
    if (seenInsulin.has(key)) {
      duplicateInsulinIds.push(ins.id);
    } else {
      seenInsulin.set(key, ins);
    }
  }
  for (const id of duplicateInsulinIds) {
    deleteInsulinLog(id);
    result.insulin++;
  }

  // 3. Activity duplicate resolution (same date, time, activity_type, and duration)
  const activities = getActivityLogs();
  const seenActivity = new Map<string, ActivityLog>();
  const duplicateActivityIds: string[] = [];
  for (const a of activities) {
    const key = `${a.log_date}_${a.log_time}_${a.activity_type}_${a.duration_min}`;
    if (seenActivity.has(key)) {
      duplicateActivityIds.push(a.id);
    } else {
      seenActivity.set(key, a);
    }
  }
  for (const id of duplicateActivityIds) {
    deleteActivityLog(id);
    result.activity++;
  }

  // 4. Feel duplicate resolution (same date, time, and feel level)
  const feels = getFeelLogs();
  const seenFeel = new Map<string, FeelLog>();
  const duplicateFeelIds: string[] = [];
  for (const fl of feels) {
    const key = `${fl.log_date}_${fl.log_time}_${fl.feel}`;
    if (seenFeel.has(key)) {
      duplicateFeelIds.push(fl.id);
    } else {
      seenFeel.set(key, fl);
    }
  }
  for (const id of duplicateFeelIds) {
    deleteFeelLog(id);
    result.feel++;
  }

  // 5. Glucose duplicate resolution (same date, time, and reading)
  const glucoses = getGlucoseLogs();
  const seenGlucose = new Map<string, GlucoseLog>();
  const duplicateGlucoseIds: string[] = [];
  for (const g of glucoses) {
    const key = `${g.log_date}_${g.log_time}_${g.reading_mgdl}`;
    if (seenGlucose.has(key)) {
      duplicateGlucoseIds.push(g.id);
    } else {
      seenGlucose.set(key, g);
    }
  }
  for (const id of duplicateGlucoseIds) {
    deleteGlucoseLog(id);
    result.glucose++;
  }

  result.total = result.insulin + result.food + result.activity + result.feel + result.glucose;
  return result;
}

// Reset / Clear all data
export function clearAllLocalData(): void {
  if (typeof window === 'undefined') return;
  memoryLogs.insulin = [];
  memoryLogs.food = [];
  memoryLogs.activity = [];
  memoryLogs.feel = [];
  memoryLogs.glucose = [];
  localStorage.removeItem(STORAGE_KEYS.INSULIN);
  localStorage.removeItem(STORAGE_KEYS.FOOD);
  localStorage.removeItem(STORAGE_KEYS.ACTIVITY);
  localStorage.removeItem(STORAGE_KEYS.FEEL);
  localStorage.removeItem(STORAGE_KEYS.GLUCOSE);
  localStorage.removeItem(STORAGE_KEYS.QUEUE);
  localStorage.removeItem(STORAGE_KEYS.DISMISSED_GLUCOSE_PROMPT);
  localStorage.removeItem(STORAGE_KEYS.DELETED_IDS);
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
