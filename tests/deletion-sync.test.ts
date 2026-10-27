import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';

// Mock browser environment for sync-storage unit tests
const storageMock = new Map<string, string>();
(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (key: string) => storageMock.get(key) || null,
  setItem: (key: string, val: string) => storageMock.set(key, String(val)),
  removeItem: (key: string) => storageMock.delete(key),
  clear: () => storageMock.clear(),
};
(globalThis as unknown as { window: unknown }).window = globalThis;
(globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class {
  constructor(public type: string) {}
};
(globalThis as unknown as { dispatchEvent: () => boolean }).dispatchEvent = () => true;

import {
  saveFoodLog,
  getFoodLogs,
  deleteFoodLog,
  isIdDeleted,
  getDeletedIdsMap,
  deduplicateLogs,
  clearAllLocalData,
} from '../src/lib/sync-storage';

describe('Deletion Tombstones and Deduplication', () => {
  beforeEach(() => {
    clearAllLocalData();
    storageMock.clear();
  });

  it('marks deleted logs in the tombstone map permanently', () => {
    const log = saveFoodLog({
      meal: 'dinner',
      items: '8 chapathi, Greengram',
      log_date: '2026-10-26',
      log_time: '20:05',
    });

    assert.strictEqual(getFoodLogs().length, 1);
    assert.strictEqual(isIdDeleted(log.id), false);

    deleteFoodLog(log.id);

    assert.strictEqual(getFoodLogs().length, 0);
    assert.strictEqual(isIdDeleted(log.id), true);

    const deletedMap = getDeletedIdsMap();
    assert.ok(deletedMap[log.id]);
    assert.strictEqual(deletedMap[log.id].table, 'food_logs');
  });

  it('deduplicates identical dinner logs safely', () => {
    // Simulate user having 3 duplicate dinner logs
    saveFoodLog({
      meal: 'dinner',
      items: '8 chapathi, Greengram',
      log_date: '2026-10-26',
      log_time: '20:05',
    });
    saveFoodLog({
      meal: 'dinner',
      items: '8 chapathi, Greengram',
      log_date: '2026-10-26',
      log_time: '20:05',
    });
    saveFoodLog({
      meal: 'dinner',
      items: '8 chapathi, Greengram',
      log_date: '2026-10-26',
      log_time: '20:05',
    });

    assert.strictEqual(getFoodLogs().length, 3);

    const res = deduplicateLogs();
    assert.strictEqual(res.food, 2);
    assert.strictEqual(res.total, 2);

    // Only 1 should remain
    const remaining = getFoodLogs();
    assert.strictEqual(remaining.length, 1);
    assert.strictEqual(remaining[0].items, '8 chapathi, Greengram');
  });

  it('saves food log with nutrients and macro calculations', () => {
    const log = saveFoodLog({
      meal: 'lunch',
      items: 'Rice, Sambar, Curd',
      carb_size: 'medium',
      carbs_g: 58.5,
      protein_g: 12.0,
      fiber_g: 4.5,
      sodium_mg: 450,
      calories: 340,
      log_date: '2026-10-27',
      log_time: '13:00',
    });

    assert.strictEqual(getFoodLogs().length, 1);
    const saved = getFoodLogs()[0];
    assert.strictEqual(saved.items, 'Rice, Sambar, Curd');
    assert.strictEqual(saved.carbs_g, 58.5);
    assert.strictEqual(saved.protein_g, 12.0);
    assert.strictEqual(saved.fiber_g, 4.5);
    assert.strictEqual(saved.sodium_mg, 450);
  });
});
