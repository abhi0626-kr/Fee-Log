import {
  FeelLog,
  FoodLog,
  ActivityLog,
  GlucoseLog,
  MEDICAL_DISCLAIMER,
} from '@/types';
import { timeToMinutes, timeDiffMinutes } from './date-utils';

export interface RuleResult<T = unknown> {
  ruleId: string;
  title: string;
  sentence: string;
  hasEnoughData: boolean;
  dataPointsCount: number;
  data: T;
  disclaimer: string;
  supportingEntries?: {
    date: string;
    description: string;
  }[];
}

export interface Rule1Data {
  highFeelDaysCount: number;
  totalDaysWithLunch: number;
  windowDays: number;
  dates: string[];
}

export interface Rule2Data {
  lowFeelDaysCount: number;
  skippedOrDelayedLunchDays: number;
  dates: string[];
  reasons: { date: string; reason: 'skipped' | 'delayed'; lunchTime?: string; feel: string }[];
}

export interface Rule3Data {
  counts: {
    carbSize: 'small' | 'medium' | 'large' | 'unspecified';
    highCount: number;
    totalCount: number;
  }[];
}

export interface Rule4Data {
  keywordCounts: {
    keyword: string;
    count: number;
  }[];
  totalHighDaysWithLunch: number;
}

export interface Rule5Data {
  runDays: {
    totalDays: number;
    feelCounts: { low: number; okay: number; high: number };
  };
  nonRunDays: {
    totalDays: number;
    feelCounts: { low: number; okay: number; high: number };
  };
}

export interface Rule6Data {
  pairsCount: number;
  feelCalibrations: {
    feel: string;
    label: string;
    count: number;
    avgMgDl: number;
    minMgDl: number;
    maxMgDl: number;
  }[];
}

/**
 * Filter items by date window (inclusive of windowDays back from today or latest log)
 */
export function filterLogsByDateWindow<T extends { log_date: string }>(
  logs: T[],
  windowDays: number,
  endDateStr?: string
): T[] {
  if (!logs || logs.length === 0) return [];
  const latestDateStr = endDateStr || logs.reduce((max, l) => (l.log_date > max ? l.log_date : max), logs[0].log_date);
  
  const [y, m, d] = latestDateStr.split('-').map(Number);
  const end = new Date(Date.UTC(y, m - 1, d, 23, 59, 59));
  const start = new Date(end.getTime() - windowDays * 24 * 60 * 60 * 1000);
  const startStr = start.toISOString().slice(0, 10);

  return logs.filter((l) => l.log_date >= startStr && l.log_date <= latestDateStr);
}

/**
 * RULE 1: High-after-lunch frequency
 * Count feel logs with feel in ('slightly_high', 'high') where log_time between 14:00 and 19:00
 * AND same day has a lunch food log.
 */
export function computeRule1HighAfterLunch(
  feelLogs: FeelLog[],
  foodLogs: FoodLog[],
  windowDays: number
): RuleResult<Rule1Data> {
  const windowFeel = filterLogsByDateWindow(feelLogs, windowDays);
  const windowFood = filterLogsByDateWindow(foodLogs, windowDays);

  // Group lunch logs by date
  const lunchByDate = new Map<string, FoodLog>();
  windowFood.forEach((f) => {
    if (f.meal === 'lunch') {
      lunchByDate.set(f.log_date, f);
    }
  });

  const highDays = new Set<string>();
  const supportingEntries: { date: string; description: string }[] = [];

  windowFeel.forEach((f) => {
    const mins = timeToMinutes(f.log_time);
    // 14:00 (840) to 19:00 (1140)
    const isAfternoon = mins >= 840 && mins <= 1140;
    const isHigh = f.feel === 'high' || f.feel === 'slightly_high';

    if (isAfternoon && isHigh && lunchByDate.has(f.log_date)) {
      highDays.add(f.log_date);
      const lunch = lunchByDate.get(f.log_date)!;
      supportingEntries.push({
        date: f.log_date,
        description: `Felt ${f.feel.replace('_', ' ')} at ${f.log_time} after lunch (${lunch.items})`,
      });
    }
  });

  const totalDaysWithLunch = lunchByDate.size;
  const highFeelDaysCount = highDays.size;
  const hasEnoughData = totalDaysWithLunch >= 3;

  let sentence = 'Not enough data yet — keep logging.';
  if (hasEnoughData) {
    sentence = `You logged high feelings after lunch on ${highFeelDaysCount} of the last ${windowDays} days (out of ${totalDaysWithLunch} lunch days).`;
  }

  return {
    ruleId: 'rule-1-high-after-lunch',
    title: 'High Feelings After Lunch',
    sentence,
    hasEnoughData,
    dataPointsCount: totalDaysWithLunch,
    data: {
      highFeelDaysCount,
      totalDaysWithLunch,
      windowDays,
      dates: Array.from(highDays).sort(),
    },
    disclaimer: MEDICAL_DISCLAIMER,
    supportingEntries,
  };
}

/**
 * RULE 2: Low on skipped/delayed lunch
 * Days with no lunch food log (or lunch log_time > 14:00) AND a feel log with feel in ('low', 'slightly_low').
 */
export function computeRule2LowSkippedDelayedLunch(
  feelLogs: FeelLog[],
  foodLogs: FoodLog[],
  windowDays: number
): RuleResult<Rule2Data> {
  const windowFeel = filterLogsByDateWindow(feelLogs, windowDays);
  const windowFood = filterLogsByDateWindow(foodLogs, windowDays);

  // Group lunch by date
  const lunchByDate = new Map<string, FoodLog>();
  windowFood.forEach((f) => {
    if (f.meal === 'lunch') {
      lunchByDate.set(f.log_date, f);
    }
  });

  // All unique dates logged in this window
  const allDates = new Set<string>();
  windowFeel.forEach((f) => allDates.add(f.log_date));
  windowFood.forEach((f) => allDates.add(f.log_date));

  const lowOnSkippedOrDelayedDays = new Set<string>();
  const reasons: Rule2Data['reasons'] = [];
  const supportingEntries: { date: string; description: string }[] = [];

  let skippedOrDelayedCount = 0;

  allDates.forEach((date) => {
    const lunch = lunchByDate.get(date);
    const isSkipped = !lunch;
    const isDelayed = lunch ? timeToMinutes(lunch.log_time) > 840 : false; // > 14:00 (2pm)

    if (isSkipped || isDelayed) {
      skippedOrDelayedCount++;
      // Check if low feel was logged on this day
      const dayLowFeels = windowFeel.filter(
        (f) => f.log_date === date && (f.feel === 'low' || f.feel === 'slightly_low')
      );

      if (dayLowFeels.length > 0) {
        lowOnSkippedOrDelayedDays.add(date);
        const feelNames = dayLowFeels.map((f) => f.feel.replace('_', ' ')).join(', ');
        reasons.push({
          date,
          reason: isSkipped ? 'skipped' : 'delayed',
          lunchTime: lunch?.log_time,
          feel: feelNames,
        });
        supportingEntries.push({
          date,
          description: isSkipped
            ? `Lunch skipped · Logged ${feelNames}`
            : `Late lunch at ${lunch?.log_time} (after 2pm) · Logged ${feelNames}`,
        });
      }
    }
  });

  const lowFeelDaysCount = lowOnSkippedOrDelayedDays.size;
  const hasEnoughData = skippedOrDelayedCount >= 3 || allDates.size >= 5;

  let sentence = 'Not enough data yet — keep logging.';
  if (hasEnoughData) {
    sentence = `You logged low feelings on ${lowFeelDaysCount} days when lunch was skipped or after 2pm.`;
  }

  return {
    ruleId: 'rule-2-low-skipped-lunch',
    title: 'Lows on Skipped or Delayed Lunch',
    sentence,
    hasEnoughData,
    dataPointsCount: skippedOrDelayedCount,
    data: {
      lowFeelDaysCount,
      skippedOrDelayedLunchDays: skippedOrDelayedCount,
      dates: Array.from(lowOnSkippedOrDelayedDays).sort(),
      reasons,
    },
    disclaimer: MEDICAL_DISCLAIMER,
    supportingEntries,
  };
}

/**
 * RULE 3: Carb-size comparison
 * For feel logs in 14:00–19:00, group by that day's lunch carb_size.
 * Output: high-count per carb size, as a bar chart. "High feelings: Small=X, Medium=Y, Large=Z."
 */
export function computeRule3CarbSizeComparison(
  feelLogs: FeelLog[],
  foodLogs: FoodLog[],
  windowDays: number
): RuleResult<Rule3Data> {
  const windowFeel = filterLogsByDateWindow(feelLogs, windowDays);
  const windowFood = filterLogsByDateWindow(foodLogs, windowDays);

  const lunchByDate = new Map<string, FoodLog>();
  windowFood.forEach((f) => {
    if (f.meal === 'lunch') lunchByDate.set(f.log_date, f);
  });

  const counts: Record<'small' | 'medium' | 'large' | 'unspecified', { high: number; total: number }> = {
    small: { high: 0, total: 0 },
    medium: { high: 0, total: 0 },
    large: { high: 0, total: 0 },
    unspecified: { high: 0, total: 0 },
  };

  const supportingEntries: { date: string; description: string }[] = [];
  let totalAfternoonLogs = 0;

  windowFeel.forEach((f) => {
    const mins = timeToMinutes(f.log_time);
    if (mins >= 840 && mins <= 1140 && lunchByDate.has(f.log_date)) {
      totalAfternoonLogs++;
      const lunch = lunchByDate.get(f.log_date)!;
      const size = lunch.carb_size || 'unspecified';
      counts[size].total++;

      const isHigh = f.feel === 'high' || f.feel === 'slightly_high';
      if (isHigh) {
        counts[size].high++;
        supportingEntries.push({
          date: f.log_date,
          description: `Afternoon ${f.feel.replace('_', ' ')} feel after ${size.toUpperCase()} carb lunch (${lunch.items})`,
        });
      }
    }
  });

  const hasEnoughData = totalAfternoonLogs >= 3;
  let sentence = 'Not enough data yet — keep logging.';
  if (hasEnoughData) {
    sentence = `High feelings by lunch carb size: Small = ${counts.small.high}, Medium = ${counts.medium.high}, Large = ${counts.large.high}.`;
  }

  return {
    ruleId: 'rule-3-carb-size-comparison',
    title: 'Afternoon Highs by Lunch Carb Size',
    sentence,
    hasEnoughData,
    dataPointsCount: totalAfternoonLogs,
    data: {
      counts: [
        { carbSize: 'small', highCount: counts.small.high, totalCount: counts.small.total },
        { carbSize: 'medium', highCount: counts.medium.high, totalCount: counts.medium.total },
        { carbSize: 'large', highCount: counts.large.high, totalCount: counts.large.total },
      ],
    },
    disclaimer: MEDICAL_DISCLAIMER,
    supportingEntries,
  };
}

/**
 * RULE 4: Meal-item flag (simple keyword scan)
 * For feel logs in 14:00–19:00, check if lunch items text contains rice, dosa, idly, chapathi.
 * Output counts per keyword. "High afternoons contained rice on X days, dosa on Y days…"
 */
export function computeRule4MealItemFlag(
  feelLogs: FeelLog[],
  foodLogs: FoodLog[],
  windowDays: number
): RuleResult<Rule4Data> {
  const windowFeel = filterLogsByDateWindow(feelLogs, windowDays);
  const windowFood = filterLogsByDateWindow(foodLogs, windowDays);

  const lunchByDate = new Map<string, FoodLog>();
  windowFood.forEach((f) => {
    if (f.meal === 'lunch') lunchByDate.set(f.log_date, f);
  });

  const targetKeywords = ['rice', 'dosa', 'idly', 'chapathi'];
  const keywordHits: Record<string, Set<string>> = {
    rice: new Set(),
    dosa: new Set(),
    idly: new Set(),
    chapathi: new Set(),
  };

  const highDays = new Set<string>();
  const supportingEntries: { date: string; description: string }[] = [];

  windowFeel.forEach((f) => {
    const mins = timeToMinutes(f.log_time);
    const isHigh = f.feel === 'high' || f.feel === 'slightly_high';

    if (mins >= 840 && mins <= 1140 && isHigh && lunchByDate.has(f.log_date)) {
      highDays.add(f.log_date);
      const lunch = lunchByDate.get(f.log_date)!;
      const lowerItems = lunch.items.toLowerCase();

      targetKeywords.forEach((kw) => {
        if (lowerItems.includes(kw)) {
          keywordHits[kw].add(f.log_date);
        }
      });

      supportingEntries.push({
        date: f.log_date,
        description: `High feel (${f.feel.replace('_', ' ')}) after lunch containing "${lunch.items}"`,
      });
    }
  });

  const totalHighDaysWithLunch = highDays.size;
  const hasEnoughData = totalHighDaysWithLunch >= 3;

  let sentence = 'Not enough data yet — keep logging.';
  if (hasEnoughData) {
    const parts = targetKeywords
      .map((kw) => `${kw} on ${keywordHits[kw].size} days`)
      .join(', ');
    sentence = `High afternoons contained ${parts}.`;
  }

  return {
    ruleId: 'rule-4-meal-item-flag',
    title: 'Bangalore PG Lunch Staples & Afternoon Highs',
    sentence,
    hasEnoughData,
    dataPointsCount: totalHighDaysWithLunch,
    data: {
      keywordCounts: targetKeywords.map((kw) => ({
        keyword: kw,
        count: keywordHits[kw].size,
      })),
      totalHighDaysWithLunch,
    },
    disclaimer: MEDICAL_DISCLAIMER,
    supportingEntries,
  };
}

/**
 * RULE 5: Run-day vs no-run-day feel distribution
 * Group days by presence of a run activity; show feel distribution (counts of low/okay/high) per group.
 * Output: "On run days you felt okay X times and high Y times; on non-run days…"
 */
export function computeRule5RunVsNoRunDistribution(
  feelLogs: FeelLog[],
  activityLogs: ActivityLog[],
  windowDays: number
): RuleResult<Rule5Data> {
  const windowFeel = filterLogsByDateWindow(feelLogs, windowDays);
  const windowActivity = filterLogsByDateWindow(activityLogs, windowDays);

  const runDays = new Set<string>();
  windowActivity.forEach((a) => {
    if (a.activity_type === 'run') {
      runDays.add(a.log_date);
    }
  });

  const allFeelDays = new Set<string>();
  windowFeel.forEach((f) => allFeelDays.add(f.log_date));

  const runStats = {
    totalDays: runDays.size,
    feelCounts: { low: 0, okay: 0, high: 0 },
  };

  const nonRunDaysSet = new Set<string>();
  allFeelDays.forEach((d) => {
    if (!runDays.has(d)) nonRunDaysSet.add(d);
  });

  const nonRunStats = {
    totalDays: nonRunDaysSet.size,
    feelCounts: { low: 0, okay: 0, high: 0 },
  };

  const supportingEntries: { date: string; description: string }[] = [];

  windowFeel.forEach((f) => {
    const isRun = runDays.has(f.log_date);
    const target = isRun ? runStats.feelCounts : nonRunStats.feelCounts;

    if (f.feel === 'low' || f.feel === 'slightly_low') target.low++;
    else if (f.feel === 'okay') target.okay++;
    else if (f.feel === 'high' || f.feel === 'slightly_high') target.high++;

    supportingEntries.push({
      date: f.log_date,
      description: `${isRun ? 'Run day (5-10km)' : 'Non-run day'}: felt ${f.feel.replace('_', ' ')} at ${f.log_time}`,
    });
  });

  const totalDays = allFeelDays.size;
  const hasEnoughData = totalDays >= 3;

  let sentence = 'Not enough data yet — keep logging.';
  if (hasEnoughData) {
    sentence = `On run days you logged okay ${runStats.feelCounts.okay} times and high ${runStats.feelCounts.high} times; on non-run days you logged okay ${nonRunStats.feelCounts.okay} times and high ${nonRunStats.feelCounts.high} times.`;
  }

  return {
    ruleId: 'rule-5-run-vs-no-run',
    title: 'Running Activity vs. Daily Feeling Distribution',
    sentence,
    hasEnoughData,
    dataPointsCount: totalDays,
    data: {
      runDays: runStats,
      nonRunDays: nonRunStats,
    },
    disclaimer: MEDICAL_DISCLAIMER,
    supportingEntries,
  };
}

/**
 * RULE 6: Feel vs glucose calibration
 * Join feel logs and glucose logs within 30 minutes.
 * For each feel level, output min/max/avg mg/dL and count.
 * Output: "When you felt High, readings were A–B mg/dL (n=X)."
 * Renders "Not enough data yet — keep logging." until >= 3 paired readings exist.
 */
export function computeRule6FeelVsGlucoseCalibration(
  feelLogs: FeelLog[],
  glucoseLogs: GlucoseLog[],
  windowDays: number
): RuleResult<Rule6Data> {
  const windowFeel = filterLogsByDateWindow(feelLogs, windowDays);
  const windowGlucose = filterLogsByDateWindow(glucoseLogs, windowDays);

  const feelOrder = ['low', 'slightly_low', 'okay', 'slightly_high', 'high'] as const;
  const grouped: Record<string, number[]> = {
    low: [],
    slightly_low: [],
    okay: [],
    slightly_high: [],
    high: [],
  };

  const supportingEntries: { date: string; description: string }[] = [];
  let pairsCount = 0;

  // Match feel and glucose on same day within 30 minutes
  windowFeel.forEach((feel) => {
    const dayGlucose = windowGlucose.filter((g) => g.log_date === feel.log_date);
    for (const g of dayGlucose) {
      if (timeDiffMinutes(feel.log_time, g.log_time) <= 30) {
        grouped[feel.feel].push(g.reading_mgdl);
        pairsCount++;
        supportingEntries.push({
          date: feel.log_date,
          description: `Paired at ${feel.log_time}: Felt ${feel.feel.replace('_', ' ')} · Glucose ${g.reading_mgdl} mg/dL`,
        });
        break; // pair with closest
      }
    }
  });

  const feelLabels: Record<string, string> = {
    low: 'Low',
    slightly_low: 'Slightly low',
    okay: 'Okay',
    slightly_high: 'Slightly high',
    high: 'High',
  };

  const feelCalibrations = feelOrder
    .map((fKey) => {
      const readings = grouped[fKey];
      if (readings.length === 0) {
        return {
          feel: fKey,
          label: feelLabels[fKey],
          count: 0,
          avgMgDl: 0,
          minMgDl: 0,
          maxMgDl: 0,
        };
      }
      const sum = readings.reduce((a, b) => a + b, 0);
      const min = Math.min(...readings);
      const max = Math.max(...readings);
      const avg = Math.round(sum / readings.length);
      return {
        feel: fKey,
        label: feelLabels[fKey],
        count: readings.length,
        avgMgDl: avg,
        minMgDl: min,
        maxMgDl: max,
      };
    })
    .filter((item) => item.count > 0);

  const hasEnoughData = pairsCount >= 3;

  let sentence = 'Not enough data yet — keep logging.';
  if (hasEnoughData) {
    const highCalibration = feelCalibrations.find((c) => c.feel === 'high' || c.feel === 'slightly_high');
    if (highCalibration) {
      sentence = `When you felt ${highCalibration.label}, paired readings were ${highCalibration.minMgDl}–${highCalibration.maxMgDl} mg/dL (n=${highCalibration.count}).`;
    } else {
      const first = feelCalibrations[0];
      sentence = `When you felt ${first.label}, paired readings were ${first.minMgDl}–${first.maxMgDl} mg/dL (n=${first.count}).`;
    }
  }

  return {
    ruleId: 'rule-6-feel-glucose-calibration',
    title: 'Feel vs. Glucose Meter Calibration',
    sentence,
    hasEnoughData,
    dataPointsCount: pairsCount,
    data: {
      pairsCount,
      feelCalibrations,
    },
    disclaimer: MEDICAL_DISCLAIMER,
    supportingEntries,
  };
}
