import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  computeRule1HighAfterLunch,
  computeRule2LowSkippedDelayedLunch,
  computeRule3CarbSizeComparison,
  computeRule4MealItemFlag,
  computeRule5RunVsNoRunDistribution,
  computeRule6FeelVsGlucoseCalibration,
} from '../src/lib/patterns';
import {
  getDefaultMealTypeByHour,
  calculateStreak,
  timeToMinutes,
  minutesToTime,
  timeDiffMinutes,
} from '../src/lib/date-utils';
import { FeelLog, FoodLog, ActivityLog, GlucoseLog, MEDICAL_DISCLAIMER } from '../src/types';

describe('Date & Logic Rules', () => {
  it('correctly determines default meal type by IST hour', () => {
    assert.strictEqual(getDefaultMealTypeByHour(7), 'breakfast');
    assert.strictEqual(getDefaultMealTypeByHour(10), 'breakfast');
    assert.strictEqual(getDefaultMealTypeByHour(11), 'lunch');
    assert.strictEqual(getDefaultMealTypeByHour(13), 'lunch');
    assert.strictEqual(getDefaultMealTypeByHour(15), 'lunch');
    assert.strictEqual(getDefaultMealTypeByHour(16), 'snack');
    assert.strictEqual(getDefaultMealTypeByHour(18), 'snack');
    assert.strictEqual(getDefaultMealTypeByHour(19), 'dinner');
    assert.strictEqual(getDefaultMealTypeByHour(22), 'dinner');
  });

  it('calculates minute conversions and time differences correctly', () => {
    assert.strictEqual(timeToMinutes('00:00'), 0);
    assert.strictEqual(timeToMinutes('14:00'), 840);
    assert.strictEqual(timeToMinutes('19:00'), 1140);
    assert.strictEqual(minutesToTime(840), '14:00');
    assert.strictEqual(timeDiffMinutes('14:15', '14:40'), 25);
    assert.strictEqual(timeDiffMinutes('14:40', '14:15'), 25);
    assert.strictEqual(timeDiffMinutes('14:00', '14:35'), 35);
  });

  it('calculates streak accurately for consecutive days', () => {
    // Empty
    assert.strictEqual(calculateStreak([]), 0);
  });
});

describe('Deterministic Pattern Rules', () => {
  const mockFoodLogs: FoodLog[] = [
    {
      id: 'f1',
      user_id: 'u1',
      log_date: '2026-10-20',
      log_time: '13:15',
      meal: 'lunch',
      items: 'rice, sambar, potato fry',
      carb_size: 'large',
    },
    {
      id: 'f2',
      user_id: 'u1',
      log_date: '2026-10-21',
      log_time: '13:00',
      meal: 'lunch',
      items: '3 dosa with coconut chutney',
      carb_size: 'medium',
    },
    {
      id: 'f3',
      user_id: 'u1',
      log_date: '2026-10-22',
      log_time: '13:30',
      meal: 'lunch',
      items: '3 idly with dal',
      carb_size: 'small',
    },
    // Late lunch (>14:00) on 2026-10-19
    {
      id: 'f4',
      user_id: 'u1',
      log_date: '2026-10-19',
      log_time: '14:45',
      meal: 'lunch',
      items: 'chapathi with dal',
      carb_size: 'medium',
    },
  ];

  const mockFeelLogs: FeelLog[] = [
    // High afternoon feel after lunch
    {
      id: 'fe1',
      user_id: 'u1',
      log_date: '2026-10-20',
      log_time: '16:30',
      feel: 'high',
      symptoms: ['thirsty', 'tired'],
    },
    {
      id: 'fe2',
      user_id: 'u1',
      log_date: '2026-10-21',
      log_time: '15:45',
      feel: 'slightly_high',
      symptoms: ['thirsty'],
    },
    {
      id: 'fe3',
      user_id: 'u1',
      log_date: '2026-10-22',
      log_time: '16:15',
      feel: 'okay',
      symptoms: [],
    },
    // Low feel on day with delayed lunch
    {
      id: 'fe4',
      user_id: 'u1',
      log_date: '2026-10-19',
      log_time: '14:15',
      feel: 'low',
      symptoms: ['shaky', 'sweaty'],
    },
    // Low feel on day with skipped lunch
    {
      id: 'fe5',
      user_id: 'u1',
      log_date: '2026-10-18',
      log_time: '15:00',
      feel: 'slightly_low',
      symptoms: ['hungry', 'dizzy'],
    },
  ];

  const mockActivityLogs: ActivityLog[] = [
    {
      id: 'a1',
      user_id: 'u1',
      log_date: '2026-10-20',
      log_time: '06:30',
      activity_type: 'run',
      duration_min: 45,
      intensity: 'moderate',
    },
    {
      id: 'a2',
      user_id: 'u1',
      log_date: '2026-10-21',
      log_time: '06:30',
      activity_type: 'run',
      duration_min: 50,
      intensity: 'moderate',
    },
  ];

  const mockGlucoseLogs: GlucoseLog[] = [
    {
      id: 'g1',
      user_id: 'u1',
      log_date: '2026-10-20',
      log_time: '16:40', // 10 min from fe1
      reading_mgdl: 260,
      context: 'post_lunch',
    },
    {
      id: 'g2',
      user_id: 'u1',
      log_date: '2026-10-21',
      log_time: '15:50', // 5 min from fe2
      reading_mgdl: 220,
      context: 'post_lunch',
    },
    {
      id: 'g3',
      user_id: 'u1',
      log_date: '2026-10-19',
      log_time: '14:20', // 5 min from fe4
      reading_mgdl: 55,
      context: 'other',
    },
  ];

  it('Rule 1: detects high-after-lunch frequency', () => {
    const res = computeRule1HighAfterLunch(mockFeelLogs, mockFoodLogs, 14);
    assert.strictEqual(res.hasEnoughData, true);
    assert.strictEqual(res.data.highFeelDaysCount, 2); // 2026-10-20 (high) & 2026-10-21 (slightly_high)
    assert.ok(res.sentence.includes('high feelings after lunch on 2 of the last 14 days'));
    assert.strictEqual(res.disclaimer, MEDICAL_DISCLAIMER);
  });

  it('Rule 1: handles < 3 data points gracefully', () => {
    const res = computeRule1HighAfterLunch(mockFeelLogs.slice(0, 1), mockFoodLogs.slice(0, 1), 14);
    assert.strictEqual(res.hasEnoughData, false);
    assert.strictEqual(res.sentence, 'Not enough data yet — keep logging.');
  });

  it('Rule 2: detects low feelings on skipped or delayed lunch', () => {
    const res = computeRule2LowSkippedDelayedLunch(mockFeelLogs, mockFoodLogs, 14);
    assert.strictEqual(res.hasEnoughData, true);
    // 2026-10-18 (skipped lunch, low feel) and 2026-10-19 (delayed lunch 14:45, low feel at 14:15)
    assert.strictEqual(res.data.lowFeelDaysCount, 2);
    assert.ok(res.sentence.includes('low feelings on 2 days when lunch was skipped or after 2pm'));
    assert.strictEqual(res.disclaimer, MEDICAL_DISCLAIMER);
  });

  it('Rule 3: compares carb sizes against afternoon feelings', () => {
    const res = computeRule3CarbSizeComparison(mockFeelLogs, mockFoodLogs, 14);
    assert.strictEqual(res.hasEnoughData, true);
    const large = res.data.counts.find((c) => c.carbSize === 'large');
    const medium = res.data.counts.find((c) => c.carbSize === 'medium');
    const small = res.data.counts.find((c) => c.carbSize === 'small');
    assert.strictEqual(large?.highCount, 1); // rice day was large
    assert.strictEqual(medium?.highCount, 1); // dosa day was medium
    assert.strictEqual(small?.highCount, 0); // idly day was okay
    assert.ok(res.sentence.includes('Small = 0, Medium = 1, Large = 1'));
  });

  it('Rule 4: scans meal items for Bangalore PG staple keywords', () => {
    const res = computeRule4MealItemFlag(mockFeelLogs, mockFoodLogs, 14);
    const riceHit = res.data.keywordCounts.find((k) => k.keyword === 'rice');
    const dosaHit = res.data.keywordCounts.find((k) => k.keyword === 'dosa');
    assert.strictEqual(riceHit?.count, 1);
    assert.strictEqual(dosaHit?.count, 1);
    assert.strictEqual(res.disclaimer, MEDICAL_DISCLAIMER);
  });

  it('Rule 5: groups feel distribution by run vs non-run days', () => {
    const res = computeRule5RunVsNoRunDistribution(mockFeelLogs, mockActivityLogs, 14);
    assert.strictEqual(res.hasEnoughData, true);
    assert.strictEqual(res.data.runDays.totalDays, 2);
    assert.strictEqual(res.disclaimer, MEDICAL_DISCLAIMER);
  });

  it('Rule 6: handles 0 glucose readings with "Not enough data yet"', () => {
    const res = computeRule6FeelVsGlucoseCalibration(mockFeelLogs, [], 14);
    assert.strictEqual(res.hasEnoughData, false);
    assert.strictEqual(res.sentence, 'Not enough data yet — keep logging.');
    assert.strictEqual(res.data.pairsCount, 0);
  });

  it('Rule 6: pairs feel and glucose within 30 minutes when readings exist', () => {
    const res = computeRule6FeelVsGlucoseCalibration(mockFeelLogs, mockGlucoseLogs, 14);
    assert.strictEqual(res.hasEnoughData, true);
    assert.strictEqual(res.data.pairsCount, 3);
    const highCalib = res.data.feelCalibrations.find((c) => c.feel === 'high');
    assert.strictEqual(highCalib?.count, 1);
    assert.strictEqual(highCalib?.minMgDl, 260);
    assert.strictEqual(highCalib?.maxMgDl, 260);

    const lowCalib = res.data.feelCalibrations.find((c) => c.feel === 'low');
    assert.strictEqual(lowCalib?.count, 1);
    assert.strictEqual(lowCalib?.minMgDl, 55);
  });
});
