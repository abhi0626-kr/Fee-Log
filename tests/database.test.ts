import { describe, it } from 'node:test';
import assert from 'node:assert';
import { insertOrUpdateRecord, readDatabase, deleteRecord } from '../src/lib/server-db';

describe('Server Database Operations', () => {
  it('inserts and reads food logs in server database', () => {
    const testLog = {
      id: 'test-food-1',
      user_id: 'user-1',
      log_date: '2026-10-23',
      log_time: '13:00',
      meal: 'lunch' as const,
      items: '2 dosa, sambar',
      carb_size: 'medium' as const,
    };

    insertOrUpdateRecord('food_logs', testLog);
    const db = readDatabase();
    const found = db.food_logs.find((f) => f.id === 'test-food-1');

    assert.ok(found);
    assert.strictEqual(found?.items, '2 dosa, sambar');
  });

  it('updates existing record in server database', () => {
    const updated = {
      id: 'test-food-1',
      user_id: 'user-1',
      log_date: '2026-10-23',
      log_time: '13:00',
      meal: 'lunch' as const,
      items: '3 dosa, coconut chutney',
      carb_size: 'large' as const,
    };

    insertOrUpdateRecord('food_logs', updated);
    const db = readDatabase();
    const found = db.food_logs.find((f) => f.id === 'test-food-1');

    assert.strictEqual(found?.items, '3 dosa, coconut chutney');
    assert.strictEqual(found?.carb_size, 'large');
  });

  it('deletes record from server database', () => {
    const deleted = deleteRecord('food_logs', 'test-food-1');
    assert.strictEqual(deleted, true);

    const db = readDatabase();
    const found = db.food_logs.find((f) => f.id === 'test-food-1');
    assert.strictEqual(found, undefined);
  });
});
