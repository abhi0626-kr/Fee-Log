import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  estimateNutrientsFromItems,
  calculateDailyMacroSummary,
} from '../src/lib/macro-calculator';
import { FoodLog } from '../src/types';

describe('Macro Calculator & Daily Fitness Tracker Tests', () => {
  test('estimates nutrients from staple Bangalore PG foods (3 idly, sambar)', () => {
    const est = estimateNutrientsFromItems('3 idly, sambar', 'medium');
    assert.equal(est.carbs_g, 46.2);
    assert.equal(est.protein_g, 13.3);
    assert.equal(est.fiber_g, 6.6);
    assert.equal(est.sodium_mg, 663);
    assert.ok(est.calories > 250);
  });

  test('estimates nutrients from single item (2 dosa)', () => {
    const est = estimateNutrientsFromItems('2 dosa', 'medium');
    assert.equal(est.carbs_g, 51.2);
    assert.equal(est.protein_g, 7.2);
    assert.equal(est.fiber_g, 2.4);
    assert.equal(est.sodium_mg, 352);
  });

  test('falls back to carb_size preset when item description is unrecognized', () => {
    const est = estimateNutrientsFromItems('some unknown local snack', 'large');
    assert.equal(est.carbs_g, 90);
    assert.equal(est.protein_g, 18);
    assert.equal(est.fiber_g, 6);
    assert.equal(est.sodium_mg, 850);
  });

  test('falls back to default medium preset on empty string', () => {
    const est = estimateNutrientsFromItems('', 'medium');
    assert.equal(est.carbs_g, 55);
    assert.equal(est.protein_g, 12);
    assert.equal(est.fiber_g, 4);
    assert.equal(est.sodium_mg, 550);
  });

  test('calculates daily macro summary with explicit stored macros and net carbs', () => {
    const mockLogs: FoodLog[] = [
      {
        id: '1',
        user_id: 'u1',
        log_date: '2026-10-26',
        log_time: '08:30',
        meal: 'breakfast',
        items: '3 idly, sambar',
        carb_size: 'medium',
        carbs_g: 60,
        protein_g: 15,
        fiber_g: 7,
        sodium_mg: 700,
        calories: 360,
      },
      {
        id: '2',
        user_id: 'u1',
        log_date: '2026-10-26',
        log_time: '13:30',
        meal: 'lunch',
        items: 'rice with dal, curd',
        carb_size: 'large',
        carbs_g: 65,
        protein_g: 18,
        fiber_g: 5,
        sodium_mg: 600,
        calories: 420,
      },
    ];

    const summary = calculateDailyMacroSummary(mockLogs, {
      daily_target_carbs_g: 180,
      daily_target_protein_g: 75,
      daily_target_fiber_g: 30,
      daily_max_sodium_mg: 2300,
    });

    assert.equal(summary.totalCarbs, 125);
    assert.equal(summary.totalProtein, 33);
    assert.equal(summary.totalFiber, 12);
    assert.equal(summary.totalSodium, 1300);
    assert.equal(summary.totalCalories, 780);
    assert.equal(summary.netCarbs, 113); // 125 - 12
    assert.equal(summary.mealCount, 2);
    assert.equal(summary.carbPercent, Math.round((125 / 180) * 100)); // 69%
    assert.equal(summary.proteinPercent, Math.round((33 / 75) * 100)); // 44%
    assert.equal(summary.fiberPercent, Math.round((12 / 30) * 100)); // 40%
    assert.equal(summary.sodiumPercent, Math.round((1300 / 2300) * 100)); // 57%
  });

  test('handles 0 logged meals gracefully', () => {
    const summary = calculateDailyMacroSummary([], {
      daily_target_carbs_g: 180,
      daily_target_protein_g: 75,
      daily_target_fiber_g: 30,
      daily_max_sodium_mg: 2300,
    });

    assert.equal(summary.totalCarbs, 0);
    assert.equal(summary.totalProtein, 0);
    assert.equal(summary.totalFiber, 0);
    assert.equal(summary.totalSodium, 0);
    assert.equal(summary.totalCalories, 0);
    assert.equal(summary.netCarbs, 0);
    assert.equal(summary.mealCount, 0);
    assert.equal(summary.carbPercent, 0);
  });
});
