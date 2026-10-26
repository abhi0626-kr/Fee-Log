import {
  CarbSize,
  FoodLog,
  FoodNutrientEstimate,
  FOOD_NUTRIENT_PRESETS,
  CARB_SIZE_PRESETS,
  UserSettings,
} from '@/types';

export interface DailyMacroSummary {
  totalCarbs: number;
  totalProtein: number;
  totalFiber: number;
  totalSodium: number;
  totalCalories: number;
  netCarbs: number;
  mealCount: number;
  targetCarbs: number;
  targetProtein: number;
  targetFiber: number;
  maxSodium: number;
  targetCalories: number;
  carbPercent: number;
  proteinPercent: number;
  fiberPercent: number;
  sodiumPercent: number;
}

/**
 * Intelligent helper to estimate nutrients from item descriptions like "3 idly, sambar"
 * or fallback smoothly to Carb Size (small/medium/large).
 */
export function estimateNutrientsFromItems(
  itemsText: string,
  carbSize: CarbSize = 'medium'
): FoodNutrientEstimate {
  const normalized = itemsText.toLowerCase().trim();
  if (!normalized) {
    return { ...CARB_SIZE_PRESETS[carbSize || 'medium'] };
  }

  // Keywords to preset mapping with pattern matching
  const rules: {
    regex: RegExp;
    presetKey: keyof typeof FOOD_NUTRIENT_PRESETS;
    defaultQty: number;
  }[] = [
    { regex: /(\d+)?\s*(?:plate\s*)?idl(?:y|ies|i)/i, presetKey: 'idly', defaultQty: 2 },
    { regex: /(\d+)?\s*dosa/i, presetKey: 'dosa', defaultQty: 1 },
    { regex: /(\d+)?\s*(?:cup\s*|bowl\s*)?rice/i, presetKey: 'rice', defaultQty: 1 },
    { regex: /(\d+)?\s*chapa(?:t|th)i|roti/i, presetKey: 'chapathi', defaultQty: 2 },
    { regex: /(\d+)?\s*(?:cup\s*|bowl\s*)?(?:dal|sambar)/i, presetKey: 'dal/sambar', defaultQty: 1 },
    { regex: /(\d+)?\s*(?:cup\s*|bowl\s*)?curd|yogurt/i, presetKey: 'curd', defaultQty: 1 },
    { regex: /(\d+)?\s*egg/i, presetKey: 'egg', defaultQty: 1 },
    { regex: /(\d+)?\s*(?:cup\s*)?(?:tea|coffee)/i, presetKey: 'tea/coffee', defaultQty: 1 },
    { regex: /(\d+)?\s*paneer/i, presetKey: 'paneer', defaultQty: 1 },
    { regex: /(\d+)?\s*chicken/i, presetKey: 'chicken', defaultQty: 1 },
    { regex: /(\d+)?\s*(?:slice\s*)?bread/i, presetKey: 'bread', defaultQty: 2 },
    { regex: /(\d+)?\s*(?:bowl\s*)?oats/i, presetKey: 'oats', defaultQty: 1 },
    { regex: /(\d+)?\s*banana/i, presetKey: 'banana', defaultQty: 1 },
    { regex: /(\d+)?\s*apple/i, presetKey: 'apple', defaultQty: 1 },
  ];

  let matchedAny = false;
  let totalCarbs = 0;
  let totalProtein = 0;
  let totalFiber = 0;
  let totalSodium = 0;
  let totalCalories = 0;

  for (const rule of rules) {
    const match = normalized.match(rule.regex);
    if (match) {
      matchedAny = true;
      const parsedQty = match[1] ? parseInt(match[1], 10) : rule.defaultQty;
      const qty = isNaN(parsedQty) || parsedQty <= 0 ? 1 : Math.min(parsedQty, 10);
      const preset = FOOD_NUTRIENT_PRESETS[rule.presetKey];

      totalCarbs += preset.carbs_g * qty;
      totalProtein += preset.protein_g * qty;
      totalFiber += preset.fiber_g * qty;
      totalSodium += preset.sodium_mg * qty;
      totalCalories += preset.calories * qty;
    }
  }

  // If no specific item was parsed from text, use carb_size preset
  if (!matchedAny) {
    return { ...CARB_SIZE_PRESETS[carbSize || 'medium'] };
  }

  // Round values nicely for display and logging
  return {
    carbs_g: Math.round(totalCarbs * 10) / 10,
    protein_g: Math.round(totalProtein * 10) / 10,
    fiber_g: Math.round(totalFiber * 10) / 10,
    sodium_mg: Math.round(totalSodium),
    calories: Math.round(totalCalories),
  };
}

/**
 * Calculates total macros and targets for a list of food logs (e.g. today's meals)
 */
export function calculateDailyMacroSummary(
  foodLogs: FoodLog[],
  settings?: Partial<UserSettings>
): DailyMacroSummary {
  const targetCarbs = settings?.daily_target_carbs_g ?? 180;
  const targetProtein = settings?.daily_target_protein_g ?? 75;
  const targetFiber = settings?.daily_target_fiber_g ?? 30;
  const maxSodium = settings?.daily_max_sodium_mg ?? 2300;
  const targetCalories = settings?.daily_target_calories ?? 2000;

  let totalCarbs = 0;
  let totalProtein = 0;
  let totalFiber = 0;
  let totalSodium = 0;
  let totalCalories = 0;

  foodLogs.forEach((log) => {
    // If exact numeric fields exist on the log, use them
    const hasExplicitMacros =
      log.carbs_g != null ||
      log.protein_g != null ||
      log.fiber_g != null ||
      log.sodium_mg != null ||
      log.calories != null;

    if (hasExplicitMacros) {
      totalCarbs += log.carbs_g ?? 0;
      totalProtein += log.protein_g ?? 0;
      totalFiber += log.fiber_g ?? 0;
      totalSodium += log.sodium_mg ?? 0;
      totalCalories += log.calories ?? (log.carbs_g ?? 0) * 4 + (log.protein_g ?? 0) * 4;
    } else {
      // Fallback estimate for legacy logs without stored macro numbers
      const estimate = estimateNutrientsFromItems(log.items, log.carb_size || 'medium');
      totalCarbs += estimate.carbs_g;
      totalProtein += estimate.protein_g;
      totalFiber += estimate.fiber_g;
      totalSodium += estimate.sodium_mg;
      totalCalories += estimate.calories;
    }
  });

  const roundedCarbs = Math.round(totalCarbs);
  const roundedProtein = Math.round(totalProtein);
  const roundedFiber = Math.round(totalFiber);
  const roundedSodium = Math.round(totalSodium);
  const roundedCalories = Math.round(totalCalories);
  const netCarbs = Math.max(0, roundedCarbs - roundedFiber);

  return {
    totalCarbs: roundedCarbs,
    totalProtein: roundedProtein,
    totalFiber: roundedFiber,
    totalSodium: roundedSodium,
    totalCalories: roundedCalories,
    netCarbs,
    mealCount: foodLogs.length,
    targetCarbs,
    targetProtein,
    targetFiber,
    maxSodium,
    targetCalories,
    carbPercent: targetCarbs > 0 ? Math.round((roundedCarbs / targetCarbs) * 100) : 0,
    proteinPercent: targetProtein > 0 ? Math.round((roundedProtein / targetProtein) * 100) : 0,
    fiberPercent: targetFiber > 0 ? Math.round((roundedFiber / targetFiber) * 100) : 0,
    sodiumPercent: maxSodium > 0 ? Math.round((roundedSodium / maxSodium) * 100) : 0,
  };
}
