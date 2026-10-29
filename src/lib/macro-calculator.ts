import {
  CarbSize,
  FoodLog,
  FoodNutrientEstimate,
  CARB_SIZE_PRESETS,
  FOOD_PORTIONS_MAP,
  ParsedFoodItemDetail,
  UserSettings,
} from '@/types';

export interface DailyMacroSummary {
  totalCarbs: number;
  totalProtein: number;
  totalFiber: number;
  totalSugar: number;
  totalSodium?: number;
  totalCalories: number;
  netCarbs: number;
  mealCount: number;
  targetCarbs: number;
  targetProtein: number;
  targetFiber: number;
  maxSugar: number;
  maxSodium?: number;
  targetCalories: number;
  carbPercent: number;
  proteinPercent: number;
  fiberPercent: number;
  sugarPercent: number;
  sodiumPercent?: number;
}

/**
 * Detailed parser that recognizes individual food items, weights (e.g. "100g Rice"),
 * and counts (e.g. "3 Egg", "2 Chapathi") from freeform text or comma-separated items.
 */
export function parseFoodItemsWithDetails(itemsText: string): ParsedFoodItemDetail[] {
  if (!itemsText || !itemsText.trim()) return [];

  // Split by comma, plus sign, or newline
  const segments = itemsText
    .split(/[,+\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const results: ParsedFoodItemDetail[] = [];

  const foodKeyMatchers: {
    regex: RegExp;
    key: string;
    defaultCount: number;
    defaultGrams: number;
  }[] = [
    { regex: /\b(?:idl(?:y|ies|i))\b/i, key: 'idly', defaultCount: 2, defaultGrams: 90 },
    { regex: /\bdosa\b/i, key: 'dosa', defaultCount: 1, defaultGrams: 80 },
    { regex: /\brice\b/i, key: 'rice', defaultCount: 1, defaultGrams: 150 },
    { regex: /\b(?:chapa(?:t|th)i|roti|phulka)\b/i, key: 'chapathi', defaultCount: 2, defaultGrams: 76 },
    { regex: /\b(?:dal|sambar)\b/i, key: 'dal/sambar', defaultCount: 1, defaultGrams: 150 },
    { regex: /\b(?:curd|yogurt)\b/i, key: 'curd', defaultCount: 1, defaultGrams: 150 },
    { regex: /\begg(?:s)?\b/i, key: 'egg', defaultCount: 1, defaultGrams: 50 },
    { regex: /\b(?:tea|coffee)\b/i, key: 'tea/coffee', defaultCount: 1, defaultGrams: 150 },
    { regex: /\bpaneer\b/i, key: 'paneer', defaultCount: 1, defaultGrams: 100 },
    { regex: /\bchicken\b/i, key: 'chicken', defaultCount: 1, defaultGrams: 100 },
    { regex: /\bbread\b/i, key: 'bread', defaultCount: 2, defaultGrams: 60 },
    { regex: /\boats\b/i, key: 'oats', defaultCount: 1, defaultGrams: 40 },
    { regex: /\bsalad\b/i, key: 'salad', defaultCount: 1, defaultGrams: 150 },
    { regex: /\bmilk\b/i, key: 'milk', defaultCount: 1, defaultGrams: 200 },
    { regex: /\b(?:nuts|almonds|walnuts)\b/i, key: 'nuts', defaultCount: 1, defaultGrams: 30 },
    { regex: /\bsprouts\b/i, key: 'sprouts', defaultCount: 1, defaultGrams: 100 },
    { regex: /\bfish\b/i, key: 'fish', defaultCount: 1, defaultGrams: 100 },
    { regex: /\bupma\b/i, key: 'upma', defaultCount: 1, defaultGrams: 150 },
    { regex: /\bpoha\b/i, key: 'poha', defaultCount: 1, defaultGrams: 150 },
    { regex: /\bbanana\b/i, key: 'banana', defaultCount: 1, defaultGrams: 118 },
    { regex: /\bapple\b/i, key: 'apple', defaultCount: 1, defaultGrams: 180 },
  ];

  for (const seg of segments) {
    // 1. Check if weight in grams/kg/ml is specified (e.g. "100g", "150 gm", "200 grams", "250ml")
    const gramMatch = seg.match(/(\d+(?:\.\d+)?)\s*(?:g|gm|gms|gram|grams|ml)\b/i);
    const kgMatch = seg.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilo|kilogram)\b/i);

    // 2. Check if quantity count is specified (e.g. "3 Egg", "2 Dosa", "4 Chapathi", "3 pcs")
    const countMatch =
      seg.match(/^(?:about\s+)?(\d+(?:\.\d+)?)\s*(?:nos|pcs|pieces?|slices?|bowls?|cups?|plates?|glass(?:es)?)?\s+/i) ||
      seg.match(/\s+(\d+(?:\.\d+)?)\s*(?:nos|pcs|pieces?|slices?|bowls?|cups?|plates?|glass(?:es)?)?$/i);

    let matchedKey: string | null = null;
    let matchedRule: (typeof foodKeyMatchers)[0] | null = null;

    for (const rule of foodKeyMatchers) {
      if (rule.regex.test(seg)) {
        matchedKey = rule.key;
        matchedRule = rule;
        break;
      }
    }

    if (!matchedKey || !matchedRule) {
      continue;
    }

    const info = FOOD_PORTIONS_MAP[matchedKey];
    if (!info) continue;

    let weightG: number | undefined;
    let quantity: number | undefined;
    let unitStr = '';
    let ratio = 1;

    if (gramMatch) {
      weightG = parseFloat(gramMatch[1]);
      unitStr = `${weightG}g`;
      ratio = weightG / 100;
    } else if (kgMatch) {
      weightG = parseFloat(kgMatch[1]) * 1000;
      unitStr = `${weightG}g`;
      ratio = weightG / 100;
    } else if (countMatch) {
      quantity = parseFloat(countMatch[1]);
      unitStr = `${quantity} ${quantity > 1 ? info.label + 's' : info.label}`;
      if (info.unitWeightG) {
        weightG = quantity * info.unitWeightG;
        ratio = weightG / 100;
      } else {
        ratio = quantity;
      }
    } else {
      // Default standard serving
      if (info.primaryUnit === 'g' || info.primaryUnit === 'ml') {
        weightG = matchedRule.defaultGrams;
        unitStr = `${weightG}g`;
        ratio = weightG / 100;
      } else {
        quantity = matchedRule.defaultCount;
        unitStr = `${quantity} serving`;
        if (info.unitWeightG) {
          weightG = quantity * info.unitWeightG;
          ratio = weightG / 100;
        } else {
          ratio = quantity;
        }
      }
    }

    results.push({
      raw: seg,
      displayName: info.label,
      icon: info.icon,
      weightG,
      quantity,
      unitStr,
      carbs_g: Math.round(info.per100g.carbs_g * ratio * 10) / 10,
      protein_g: Math.round(info.per100g.protein_g * ratio * 10) / 10,
      fiber_g: Math.round(info.per100g.fiber_g * ratio * 10) / 10,
      sugar_g: Math.round(info.per100g.sugar_g * ratio * 10) / 10,
      sodium_mg: Math.round((info.per100g.sodium_mg ?? 0) * ratio),
      calories: Math.round(info.per100g.calories * ratio),
    });
  }

  return results;
}

/**
 * Intelligent helper to estimate nutrients from item descriptions like "100g Rice, 3 Egg"
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

  const parsedDetails = parseFoodItemsWithDetails(itemsText);
  if (parsedDetails.length > 0) {
    let totalCarbs = 0;
    let totalProtein = 0;
    let totalFiber = 0;
    let totalSugar = 0;
    let totalSodium = 0;
    let totalCalories = 0;

    for (const item of parsedDetails) {
      totalCarbs += item.carbs_g;
      totalProtein += item.protein_g;
      totalFiber += item.fiber_g;
      totalSugar += item.sugar_g;
      totalSodium += item.sodium_mg ?? 0;
      totalCalories += item.calories;
    }

    return {
      carbs_g: Math.round(totalCarbs * 10) / 10,
      protein_g: Math.round(totalProtein * 10) / 10,
      fiber_g: Math.round(totalFiber * 10) / 10,
      sugar_g: Math.round(totalSugar * 10) / 10,
      sodium_mg: Math.round(totalSodium),
      calories: Math.round(totalCalories),
    };
  }

  // Fallback to carb_size preset
  return { ...CARB_SIZE_PRESETS[carbSize || 'medium'] };
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
  const maxSugar = settings?.daily_max_sugar_g ?? 25;
  const maxSodium = settings?.daily_max_sodium_mg ?? 2300;
  const targetCalories = settings?.daily_target_calories ?? 2000;

  let totalCarbs = 0;
  let totalProtein = 0;
  let totalFiber = 0;
  let totalSugar = 0;
  let totalSodium = 0;
  let totalCalories = 0;

  foodLogs.forEach((log) => {
    // If exact numeric fields exist on the log, use them
    const hasExplicitMacros =
      log.carbs_g != null ||
      log.protein_g != null ||
      log.fiber_g != null ||
      log.sugar_g != null ||
      log.sodium_mg != null ||
      log.calories != null;

    if (hasExplicitMacros) {
      totalCarbs += log.carbs_g ?? 0;
      totalProtein += log.protein_g ?? 0;
      totalFiber += log.fiber_g ?? 0;
      totalSugar += log.sugar_g ?? 0;
      totalSodium += log.sodium_mg ?? 0;
      totalCalories += log.calories ?? (log.carbs_g ?? 0) * 4 + (log.protein_g ?? 0) * 4;
    } else {
      // Fallback estimate for legacy logs without stored macro numbers
      const estimate = estimateNutrientsFromItems(log.items, log.carb_size || 'medium');
      totalCarbs += estimate.carbs_g;
      totalProtein += estimate.protein_g;
      totalFiber += estimate.fiber_g;
      totalSugar += estimate.sugar_g;
      totalSodium += estimate.sodium_mg ?? 0;
      totalCalories += estimate.calories;
    }
  });

  const roundedCarbs = Math.round(totalCarbs);
  const roundedProtein = Math.round(totalProtein);
  const roundedFiber = Math.round(totalFiber);
  const roundedSugar = Math.round(totalSugar * 10) / 10;
  const roundedSodium = Math.round(totalSodium);
  const roundedCalories = Math.round(totalCalories);
  const netCarbs = Math.max(0, roundedCarbs - roundedFiber);

  return {
    totalCarbs: roundedCarbs,
    totalProtein: roundedProtein,
    totalFiber: roundedFiber,
    totalSugar: roundedSugar,
    totalSodium: roundedSodium,
    totalCalories: roundedCalories,
    netCarbs,
    mealCount: foodLogs.length,
    targetCarbs,
    targetProtein,
    targetFiber,
    maxSugar,
    maxSodium,
    targetCalories,
    carbPercent: targetCarbs > 0 ? Math.round((roundedCarbs / targetCarbs) * 100) : 0,
    proteinPercent: targetProtein > 0 ? Math.round((roundedProtein / targetProtein) * 100) : 0,
    fiberPercent: targetFiber > 0 ? Math.round((roundedFiber / targetFiber) * 100) : 0,
    sugarPercent: maxSugar > 0 ? Math.round((roundedSugar / maxSugar) * 100) : 0,
    sodiumPercent: maxSodium > 0 ? Math.round((roundedSodium / maxSodium) * 100) : 0,
  };
}
