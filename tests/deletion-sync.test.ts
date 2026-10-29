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
  saveInsulinLog,
  getInsulinLogs,
  deleteFoodLog,
  isIdDeleted,
  getDeletedIdsMap,
  deduplicateLogs,
  clearAllLocalData,
  mergeFoodRecords,
  mergeRecordsById,
  getOfflineQueue,
  getUnifiedLogsForDate,
} from '../src/lib/sync-storage';
import {
  estimateNutrientsFromItems,
  parseFoodItemsWithDetails,
  calculateDailyMacroSummary,
} from '../src/lib/macro-calculator';
import { FoodLog } from '../src/types';

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

  it('updates food timing from 08:25 to 09:25 and preserves it against stale remote hydration', () => {
    // 1. Initial creation at 08:25
    const initialLog = saveFoodLog({
      meal: 'breakfast',
      items: '7 chapathi',
      carb_size: 'medium',
      log_date: '2026-10-27',
      log_time: '08:25',
    });

    assert.strictEqual(getFoodLogs()[0].log_time, '08:25');
    const originalCreatedAt = initialLog.created_at;

    // 2. User edits timing to 09:25
    const updatedLog = saveFoodLog({
      id: initialLog.id,
      meal: 'breakfast',
      items: '7 chapathi',
      carb_size: 'medium',
      log_date: '2026-10-27',
      log_time: '09:25',
    });

    assert.strictEqual(updatedLog.log_time, '09:25');
    assert.strictEqual(getFoodLogs()[0].log_time, '09:25');
    // Ensure original created_at timestamp is preserved
    assert.strictEqual(updatedLog.created_at, originalCreatedAt);

    // Verify queue deduplication has 1 update item
    const queue = getOfflineQueue();
    const foodQueueItems = queue.filter((q) => q.table === 'food_logs' && q.id === initialLog.id);
    assert.strictEqual(foodQueueItems.length, 1);
    assert.strictEqual((foodQueueItems[0].payload as { log_time: string }).log_time, '09:25');

    // 3. Simulate remote database still having old 08:25 timing before write completes
    const staleRemoteFood = [
      {
        ...initialLog,
        log_time: '08:25',
      },
    ];

    const pendingIds = new Set([initialLog.id]);
    const merged = mergeFoodRecords(getFoodLogs(), staleRemoteFood, pendingIds);

    // Must NOT revert to 08:25 - must retain user's 09:25 update!
    assert.strictEqual(merged.length, 1);
    assert.strictEqual(merged[0].log_time, '09:25');
  });

  it('immediately updates chronological order in unified logs when timing changes', () => {
    // Morning Regular Dose at 08:55
    saveInsulinLog({
      insulin_type: 'morning_regular',
      units: 20,
      taken: true,
      log_date: '2026-10-27',
      log_time: '08:55',
    });

    // Breakfast at 08:25
    const food = saveFoodLog({
      meal: 'breakfast',
      items: '7 chapathi',
      carb_size: 'medium',
      log_date: '2026-10-27',
      log_time: '08:25',
    });

    // When breakfast is at 08:25, it comes first
    let feed = getUnifiedLogsForDate('2026-10-27');
    assert.strictEqual(feed.length, 2);
    assert.strictEqual(feed[0].category, 'food');
    assert.strictEqual(feed[0].log_time, '08:25');
    assert.strictEqual(feed[1].category, 'insulin');
    assert.strictEqual(feed[1].log_time, '08:55');

    // User updates timing to 09:25
    saveFoodLog({
      id: food.id,
      meal: 'breakfast',
      items: '7 chapathi',
      carb_size: 'medium',
      log_date: '2026-10-27',
      log_time: '09:25',
    });

    // Now insulin at 08:55 comes first, breakfast at 09:25 comes second!
    feed = getUnifiedLogsForDate('2026-10-27');
    assert.strictEqual(feed.length, 2);
    assert.strictEqual(feed[0].category, 'insulin');
    assert.strictEqual(feed[0].log_time, '08:55');
    assert.strictEqual(feed[1].category, 'food');
    assert.strictEqual(feed[1].log_time, '09:25');
  });

  it('accurately parses weight of food ("100g Rice") and quantity ("3 Egg")', () => {
    // 1. Test "100g Rice"
    const riceDetails = parseFoodItemsWithDetails('100g Rice');
    assert.strictEqual(riceDetails.length, 1);
    assert.strictEqual(riceDetails[0].displayName, 'Rice');
    assert.strictEqual(riceDetails[0].weightG, 100);
    assert.strictEqual(riceDetails[0].carbs_g, 28);
    assert.strictEqual(riceDetails[0].protein_g, 2.7);
    assert.strictEqual(riceDetails[0].sugar_g, 0.1);
    assert.strictEqual(riceDetails[0].calories, 130);

    // 2. Test "3 Egg"
    const eggDetails = parseFoodItemsWithDetails('3 Egg');
    assert.strictEqual(eggDetails.length, 1);
    assert.strictEqual(eggDetails[0].displayName, 'Egg');
    assert.strictEqual(eggDetails[0].quantity, 3);
    assert.strictEqual(eggDetails[0].carbs_g, 1.7); // 150g egg = 1.1 * 1.5 = 1.65 -> 1.7
    assert.strictEqual(eggDetails[0].protein_g, 18.9); // 150g egg = 12.6 * 1.5 = 18.9
    assert.strictEqual(eggDetails[0].sugar_g, 0.6); // 150g egg = 0.4 * 1.5 = 0.6
    assert.strictEqual(eggDetails[0].calories, 233); // 155 * 1.5 = 232.5 -> 233

    // 3. Test Combined "100g Rice, 3 Egg"
    const combinedNutrients = estimateNutrientsFromItems('100g Rice, 3 Egg');
    // Total Carbs = 28 + 1.7 = 29.7
    assert.strictEqual(combinedNutrients.carbs_g, 29.7);
    // Total Protein = 2.7 + 18.9 = 21.6
    assert.strictEqual(combinedNutrients.protein_g, 21.6);
    // Total Sugar = 0.1 + 0.6 = 0.7
    assert.strictEqual(combinedNutrients.sugar_g, 0.7);
    // Total Calories = 130 + 233 = 363
    assert.strictEqual(combinedNutrients.calories, 363);

    // 4. Test Mixed Units: "2 Chapathi, 100g Dal"
    const mixedDetails = parseFoodItemsWithDetails('2 Chapathi, 100g Dal');
    assert.strictEqual(mixedDetails.length, 2);
    assert.strictEqual(mixedDetails[0].displayName, 'Chapathi');
    assert.strictEqual(mixedDetails[0].quantity, 2);
    assert.strictEqual(mixedDetails[1].displayName, 'Dal / Sambar');
    assert.strictEqual(mixedDetails[1].weightG, 100);

    const mixedNutrients = estimateNutrientsFromItems('2 Chapathi, 100g Dal');
    // 2 Chapathi: 76g * 0.48 = 36.5g carbs; 100g Dal: 11g carbs -> 47.5g carbs
    assert.strictEqual(mixedNutrients.carbs_g, 47.5);
    // 2 Chapathi: 76g * 0.085 = 6.5g protein; 100g Dal: 4.8g protein -> 11.3g protein
    assert.strictEqual(mixedNutrients.protein_g, 11.3);
  });

  it('correctly tracks daily sugar count in grams instead of sodium', () => {
    const foodLogs: FoodLog[] = [
      {
        id: 'food-1',
        user_id: 'test-user',
        log_date: '2026-10-27',
        log_time: '08:30',
        meal: 'breakfast',
        items: '100g Rice, 3 Egg',
        carbs_g: 29.7,
        protein_g: 21.6,
        fiber_g: 0.4,
        sugar_g: 0.7,
        calories: 363,
      },
      {
        id: 'food-2',
        user_id: 'test-user',
        log_date: '2026-10-27',
        log_time: '13:30',
        meal: 'lunch',
        items: '2 Chapathi, 100g Dal, 1 Banana',
        carbs_g: 74.6,
        protein_g: 12.6,
        fiber_g: 10.5,
        sugar_g: 17.6,
        calories: 450,
      },
    ];

    const summary = calculateDailyMacroSummary(foodLogs, { daily_max_sugar_g: 25 });
    // Total Sugar = 0.7 + 17.6 = 18.3g
    assert.strictEqual(summary.totalSugar, 18.3);
    assert.strictEqual(summary.maxSugar, 25);
    // 18.3 / 25 * 100 = 73.2% -> 73%
    assert.strictEqual(summary.sugarPercent, 73);
  });
});
