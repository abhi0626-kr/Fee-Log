export type InsulinType =
  | 'morning_regular'
  | 'afternoon_regular'
  | 'night_30_70'
  | 'correction'
  | 'other';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type CarbSize = 'small' | 'medium' | 'large';
export type ActivityType = 'run' | 'calisthenics' | 'walk' | 'other';
export type IntensityType = 'light' | 'moderate' | 'hard';
export type FeelLevel = 'low' | 'slightly_low' | 'okay' | 'slightly_high' | 'high';
export type GlucoseContext = 'fasting' | 'post_lunch' | 'pre_bed' | 'other';

export interface Profile {
  id: string;
  display_name: string;
  height_cm: number;
  weight_kg: number;
  morning_regular_default: number;
  night_30_70_default: number;
  created_at?: string;
}

export interface InsulinLog {
  id: string;
  user_id: string;
  log_date: string; // YYYY-MM-DD in IST
  log_time: string; // HH:mm (or HH:mm:ss) in IST
  insulin_type: InsulinType;
  units: number;
  taken: boolean;
  note?: string | null;
  created_at?: string;
}

export interface FoodLog {
  id: string;
  user_id: string;
  log_date: string; // YYYY-MM-DD in IST
  log_time: string; // HH:mm in IST
  meal: MealType;
  items: string;
  carb_size?: CarbSize | null;
  photo_url?: string | null;
  note?: string | null;
  carbs_g?: number | null;
  protein_g?: number | null;
  fiber_g?: number | null;
  sugar_g?: number | null;
  sodium_mg?: number | null;
  calories?: number | null;
  created_at?: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  log_date: string; // YYYY-MM-DD in IST
  log_time: string; // HH:mm in IST
  activity_type: ActivityType;
  duration_min: number;
  intensity?: IntensityType | null;
  note?: string | null;
  created_at?: string;
}

export interface FeelLog {
  id: string;
  user_id: string;
  log_date: string; // YYYY-MM-DD in IST
  log_time: string; // HH:mm in IST
  feel: FeelLevel;
  symptoms: string[];
  note?: string | null;
  created_at?: string;
}

export interface GlucoseLog {
  id: string;
  user_id: string;
  log_date: string; // YYYY-MM-DD in IST
  log_time: string; // HH:mm in IST
  reading_mgdl: number;
  context?: GlucoseContext | null;
  note?: string | null;
  created_at?: string;
}

export type LogCategory = 'insulin' | 'food' | 'activity' | 'feel' | 'glucose';

export interface UnifiedLogItem {
  id: string;
  category: LogCategory;
  user_id: string;
  log_date: string;
  log_time: string;
  created_at?: string;
  // Specific data
  insulin?: InsulinLog;
  food?: FoodLog;
  activity?: ActivityLog;
  feel?: FeelLog;
  glucose?: GlucoseLog;
}

export interface UserSettings {
  // Personal & Identity
  user_id?: string;
  display_name: string;
  email?: string;
  avatar_url?: string;
  auth_provider?: 'google' | 'email' | 'guest';
  is_logged_in?: boolean;
  age?: number;
  gender?: string;
  height_cm: number;
  weight_kg: number;

  // Location & Context
  city: string; // e.g. "Bangalore"
  residence_area?: string; // e.g. "Koramangala PG"
  native_location?: string; // e.g. "Coimbatore, Tamil Nadu"
  lifestyle_note?: string; // e.g. "Studying & Running away from native Tamil Nadu"
  timezone: string; // e.g. "Asia/Kolkata"

  // Emergency / Clinical Contact
  doctor_name?: string;
  doctor_phone?: string;
  clinic_name?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;

  // Morning Dose Config
  morning_insulin_brand: string; // e.g. "Regular (R)"
  morning_regular_units: number;
  morning_target_time: string; // e.g. "08:00"
  morning_meal_note?: string; // e.g. "Before breakfast (Idly / Dosa)"

  // Midday Dose Config
  midday_insulin_brand: string; // e.g. "Regular (R)"
  afternoon_regular_units?: number;
  midday_target_time: string; // e.g. "13:30"
  midday_meal_note?: string; // e.g. "Before lunch / body condition"

  // Night Dose Config
  night_insulin_brand: string; // e.g. "30/70 Biphasic Mix"
  night_30_70_units: number;
  night_target_time: string; // e.g. "20:30"
  night_meal_note?: string; // e.g. "Before dinner (Chapati / Rice)"

  // Correction Dose Config
  correction_insulin_brand?: string; // e.g. "Regular / Rapid"
  correction_default_units?: number;

  // Daily Nutrition & Macro Targets (Fitness Tracker style)
  daily_target_carbs_g?: number; // e.g. 180g
  daily_target_protein_g?: number; // e.g. 75g
  daily_target_fiber_g?: number; // e.g. 30g
  daily_max_sugar_g?: number; // e.g. 25g
  daily_max_sodium_mg?: number; // e.g. 2300mg
  daily_target_calories?: number; // e.g. 2000 kcal

  // AI Food Scanner Config
  gemini_api_key?: string;
  openai_api_key?: string;

  activity_chips: string[];
  food_chips: string[];
}

export interface FoodNutrientEstimate {
  carbs_g: number;
  protein_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg?: number;
  calories: number;
}

export const FOOD_NUTRIENT_PRESETS: Record<string, FoodNutrientEstimate> = {
  idly: { carbs_g: 15, protein_g: 2.5, fiber_g: 1.0, sugar_g: 0.2, sodium_mg: 120, calories: 65 },
  dosa: { carbs_g: 26, protein_g: 3.5, fiber_g: 1.2, sugar_g: 0.5, sodium_mg: 180, calories: 160 },
  rice: { carbs_g: 45, protein_g: 4.0, fiber_g: 0.6, sugar_g: 0.1, sodium_mg: 5, calories: 205 },
  chapathi: { carbs_g: 18, protein_g: 3.2, fiber_g: 2.2, sugar_g: 0.8, sodium_mg: 110, calories: 104 },
  'dal/sambar': { carbs_g: 16, protein_g: 7.0, fiber_g: 4.0, sugar_g: 2.5, sodium_mg: 420, calories: 130 },
  curd: { carbs_g: 4.5, protein_g: 4.0, fiber_g: 0.0, sugar_g: 4.5, sodium_mg: 55, calories: 60 },
  egg: { carbs_g: 0.6, protein_g: 6.3, fiber_g: 0.0, sugar_g: 0.4, sodium_mg: 70, calories: 78 },
  'tea/coffee': { carbs_g: 6.0, protein_g: 1.0, fiber_g: 0.0, sugar_g: 5.0, sodium_mg: 35, calories: 45 },
  paneer: { carbs_g: 3.5, protein_g: 14.0, fiber_g: 0.0, sugar_g: 1.2, sodium_mg: 18, calories: 265 },
  chicken: { carbs_g: 0.0, protein_g: 27.0, fiber_g: 0.0, sugar_g: 0.0, sodium_mg: 82, calories: 165 },
  bread: { carbs_g: 15.0, protein_g: 3.0, fiber_g: 1.0, sugar_g: 1.5, sodium_mg: 150, calories: 75 },
  oats: { carbs_g: 27.0, protein_g: 5.0, fiber_g: 4.0, sugar_g: 0.8, sodium_mg: 2, calories: 150 },
  banana: { carbs_g: 27.0, protein_g: 1.3, fiber_g: 3.1, sugar_g: 14.0, sodium_mg: 1, calories: 105 },
  apple: { carbs_g: 25.0, protein_g: 0.5, fiber_g: 4.4, sugar_g: 19.0, sodium_mg: 2, calories: 95 },
  upma: { carbs_g: 30.0, protein_g: 5.0, fiber_g: 2.5, sugar_g: 1.5, sodium_mg: 320, calories: 180 },
  poha: { carbs_g: 32.0, protein_g: 4.0, fiber_g: 2.0, sugar_g: 1.2, sodium_mg: 280, calories: 175 },
  pongal: { carbs_g: 35.0, protein_g: 6.0, fiber_g: 2.0, sugar_g: 0.5, sodium_mg: 310, calories: 210 },
  salad: { carbs_g: 6.0, protein_g: 2.0, fiber_g: 3.0, sugar_g: 2.8, sodium_mg: 45, calories: 45 },
  milk: { carbs_g: 12.0, protein_g: 8.0, fiber_g: 0.0, sugar_g: 12.0, sodium_mg: 120, calories: 150 },
  nuts: { carbs_g: 4.0, protein_g: 5.0, fiber_g: 2.5, sugar_g: 1.2, sodium_mg: 5, calories: 160 },
  sprouts: { carbs_g: 14.0, protein_g: 8.0, fiber_g: 5.0, sugar_g: 2.0, sodium_mg: 25, calories: 95 },
  fish: { carbs_g: 0.0, protein_g: 22.0, fiber_g: 0.0, sugar_g: 0.0, sodium_mg: 75, calories: 120 },
};

export const CARB_SIZE_PRESETS: Record<CarbSize, FoodNutrientEstimate> = {
  small: { carbs_g: 25, protein_g: 6, fiber_g: 2, sugar_g: 2, sodium_mg: 250, calories: 180 },
  medium: { carbs_g: 55, protein_g: 12, fiber_g: 4, sugar_g: 5, sodium_mg: 550, calories: 380 },
  large: { carbs_g: 90, protein_g: 18, fiber_g: 6, sugar_g: 8, sodium_mg: 850, calories: 620 },
};

export interface FoodPortionInfo {
  foodKey: string;
  label: string;
  icon: string;
  per100g: FoodNutrientEstimate;
  unitWeightG?: number;
  primaryUnit: 'g' | 'pcs' | 'cups' | 'ml';
  quickPortions: { label: string; value: string; isWeight?: boolean }[];
}

export interface ParsedFoodItemDetail {
  raw: string;
  displayName: string;
  icon: string;
  weightG?: number;
  quantity?: number;
  unitStr: string;
  carbs_g: number;
  protein_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg?: number;
  calories: number;
}

export const FOOD_PORTIONS_MAP: Record<string, FoodPortionInfo> = {
  rice: {
    foodKey: 'rice',
    label: 'Rice',
    icon: '🌾',
    per100g: { carbs_g: 28.0, protein_g: 2.7, fiber_g: 0.4, sugar_g: 0.1, sodium_mg: 2, calories: 130 },
    unitWeightG: 150,
    primaryUnit: 'g',
    quickPortions: [
      { label: '100g', value: '100g Rice', isWeight: true },
      { label: '150g', value: '150g Rice', isWeight: true },
      { label: '200g', value: '200g Rice', isWeight: true },
      { label: '1 cup', value: '1 cup Rice' },
    ],
  },
  egg: {
    foodKey: 'egg',
    label: 'Egg',
    icon: '🥚',
    per100g: { carbs_g: 1.1, protein_g: 12.6, fiber_g: 0.0, sugar_g: 0.4, sodium_mg: 140, calories: 155 },
    unitWeightG: 50,
    primaryUnit: 'pcs',
    quickPortions: [
      { label: '1', value: '1 Egg' },
      { label: '2', value: '2 Egg' },
      { label: '3', value: '3 Egg' },
      { label: '4', value: '4 Egg' },
    ],
  },
  idly: {
    foodKey: 'idly',
    label: 'Idly',
    icon: '⚪',
    per100g: { carbs_g: 22.0, protein_g: 4.5, fiber_g: 1.8, sugar_g: 0.3, sodium_mg: 180, calories: 120 },
    unitWeightG: 45,
    primaryUnit: 'pcs',
    quickPortions: [
      { label: '2 idly', value: '2 Idly' },
      { label: '3 idly', value: '3 Idly' },
      { label: '4 idly', value: '4 Idly' },
      { label: '100g', value: '100g Idly', isWeight: true },
    ],
  },
  dosa: {
    foodKey: 'dosa',
    label: 'Dosa',
    icon: '🥞',
    per100g: { carbs_g: 32.0, protein_g: 4.5, fiber_g: 1.5, sugar_g: 0.6, sodium_mg: 220, calories: 195 },
    unitWeightG: 80,
    primaryUnit: 'pcs',
    quickPortions: [
      { label: '1 dosa', value: '1 Dosa' },
      { label: '2 dosa', value: '2 Dosa' },
      { label: '3 dosa', value: '3 Dosa' },
    ],
  },
  chapathi: {
    foodKey: 'chapathi',
    label: 'Chapathi',
    icon: '🫓',
    per100g: { carbs_g: 48.0, protein_g: 8.5, fiber_g: 6.0, sugar_g: 1.8, sodium_mg: 280, calories: 280 },
    unitWeightG: 38,
    primaryUnit: 'pcs',
    quickPortions: [
      { label: '1', value: '1 Chapathi' },
      { label: '2', value: '2 Chapathi' },
      { label: '3', value: '3 Chapathi' },
      { label: '4', value: '4 Chapathi' },
      { label: '100g', value: '100g Chapathi', isWeight: true },
    ],
  },
  'dal/sambar': {
    foodKey: 'dal/sambar',
    label: 'Dal / Sambar',
    icon: '🥣',
    per100g: { carbs_g: 11.0, protein_g: 4.8, fiber_g: 2.8, sugar_g: 1.8, sodium_mg: 280, calories: 88 },
    unitWeightG: 150,
    primaryUnit: 'g',
    quickPortions: [
      { label: '100g', value: '100g Dal', isWeight: true },
      { label: '150g', value: '150g Dal', isWeight: true },
      { label: '200g', value: '200g Dal', isWeight: true },
      { label: '1 bowl', value: '1 bowl Sambar' },
    ],
  },
  curd: {
    foodKey: 'curd',
    label: 'Curd',
    icon: '🥛',
    per100g: { carbs_g: 4.5, protein_g: 3.5, fiber_g: 0.0, sugar_g: 4.5, sodium_mg: 45, calories: 60 },
    unitWeightG: 150,
    primaryUnit: 'g',
    quickPortions: [
      { label: '100g', value: '100g Curd', isWeight: true },
      { label: '150g', value: '150g Curd', isWeight: true },
      { label: '200g', value: '200g Curd', isWeight: true },
      { label: '1 cup', value: '1 cup Curd' },
    ],
  },
  'tea/coffee': {
    foodKey: 'tea/coffee',
    label: 'Tea / Coffee',
    icon: '☕',
    per100g: { carbs_g: 4.0, protein_g: 0.8, fiber_g: 0.0, sugar_g: 3.5, sodium_mg: 25, calories: 32 },
    unitWeightG: 150,
    primaryUnit: 'cups',
    quickPortions: [
      { label: '1 cup', value: '1 cup Tea' },
      { label: '2 cups', value: '2 cups Tea' },
      { label: '1 coffee', value: '1 cup Coffee' },
    ],
  },
  chicken: {
    foodKey: 'chicken',
    label: 'Chicken',
    icon: '🍗',
    per100g: { carbs_g: 0.0, protein_g: 31.0, fiber_g: 0.0, sugar_g: 0.0, sodium_mg: 80, calories: 165 },
    unitWeightG: 100,
    primaryUnit: 'g',
    quickPortions: [
      { label: '100g', value: '100g Chicken', isWeight: true },
      { label: '150g', value: '150g Chicken', isWeight: true },
      { label: '200g', value: '200g Chicken', isWeight: true },
    ],
  },
  paneer: {
    foodKey: 'paneer',
    label: 'Paneer',
    icon: '🧀',
    per100g: { carbs_g: 3.5, protein_g: 18.0, fiber_g: 0.0, sugar_g: 1.2, sodium_mg: 20, calories: 265 },
    unitWeightG: 100,
    primaryUnit: 'g',
    quickPortions: [
      { label: '50g', value: '50g Paneer', isWeight: true },
      { label: '100g', value: '100g Paneer', isWeight: true },
      { label: '150g', value: '150g Paneer', isWeight: true },
      { label: '200g', value: '200g Paneer', isWeight: true },
    ],
  },
  oats: {
    foodKey: 'oats',
    label: 'Oats',
    icon: '🥣',
    per100g: { carbs_g: 66.0, protein_g: 13.0, fiber_g: 10.0, sugar_g: 1.2, sodium_mg: 5, calories: 380 },
    unitWeightG: 40,
    primaryUnit: 'g',
    quickPortions: [
      { label: '40g', value: '40g Oats', isWeight: true },
      { label: '50g', value: '50g Oats', isWeight: true },
      { label: '80g', value: '80g Oats', isWeight: true },
      { label: '100g', value: '100g Oats', isWeight: true },
    ],
  },
  bread: {
    foodKey: 'bread',
    label: 'Bread',
    icon: '🍞',
    per100g: { carbs_g: 49.0, protein_g: 9.0, fiber_g: 2.7, sugar_g: 5.0, sodium_mg: 490, calories: 265 },
    unitWeightG: 30,
    primaryUnit: 'pcs',
    quickPortions: [
      { label: '1 slice', value: '1 slice Bread' },
      { label: '2 slices', value: '2 slices Bread' },
      { label: '3 slices', value: '3 slices Bread' },
    ],
  },
  salad: {
    foodKey: 'salad',
    label: 'Salad',
    icon: '🥗',
    per100g: { carbs_g: 4.0, protein_g: 1.5, fiber_g: 2.5, sugar_g: 2.0, sodium_mg: 35, calories: 25 },
    unitWeightG: 150,
    primaryUnit: 'g',
    quickPortions: [
      { label: '100g', value: '100g Salad', isWeight: true },
      { label: '150g', value: '150g Salad', isWeight: true },
      { label: '200g', value: '200g Salad', isWeight: true },
    ],
  },
  upma: {
    foodKey: 'upma',
    label: 'Upma',
    icon: '🍲',
    per100g: { carbs_g: 22.0, protein_g: 3.5, fiber_g: 1.8, sugar_g: 1.1, sodium_mg: 220, calories: 130 },
    unitWeightG: 150,
    primaryUnit: 'g',
    quickPortions: [
      { label: '100g', value: '100g Upma', isWeight: true },
      { label: '150g', value: '150g Upma', isWeight: true },
      { label: '200g', value: '200g Upma', isWeight: true },
    ],
  },
  poha: {
    foodKey: 'poha',
    label: 'Poha',
    icon: '🍛',
    per100g: { carbs_g: 24.0, protein_g: 3.0, fiber_g: 1.5, sugar_g: 0.9, sodium_mg: 200, calories: 135 },
    unitWeightG: 150,
    primaryUnit: 'g',
    quickPortions: [
      { label: '100g', value: '100g Poha', isWeight: true },
      { label: '150g', value: '150g Poha', isWeight: true },
      { label: '200g', value: '200g Poha', isWeight: true },
    ],
  },
  banana: {
    foodKey: 'banana',
    label: 'Banana',
    icon: '🍌',
    per100g: { carbs_g: 23.0, protein_g: 1.1, fiber_g: 2.6, sugar_g: 12.2, sodium_mg: 1, calories: 89 },
    unitWeightG: 118,
    primaryUnit: 'pcs',
    quickPortions: [
      { label: '1 Banana', value: '1 Banana' },
      { label: '2 Banana', value: '2 Banana' },
    ],
  },
  apple: {
    foodKey: 'apple',
    label: 'Apple',
    icon: '🍎',
    per100g: { carbs_g: 14.0, protein_g: 0.3, fiber_g: 2.4, sugar_g: 10.4, sodium_mg: 1, calories: 52 },
    unitWeightG: 180,
    primaryUnit: 'pcs',
    quickPortions: [
      { label: '1 Apple', value: '1 Apple' },
    ],
  },
};

export const FEEL_COLORS: Record<FeelLevel, { hex: string; bg: string; text: string; label: string; badge: string }> = {
  low: {
    hex: '#dc2626',
    bg: 'bg-red-600',
    text: 'text-red-600',
    label: 'Low',
    badge: 'bg-red-50 text-red-700 border-red-200',
  },
  slightly_low: {
    hex: '#f59e0b',
    bg: 'bg-amber-500',
    text: 'text-amber-600',
    label: 'Slightly low',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  okay: {
    hex: '#16a34a',
    bg: 'bg-green-600',
    text: 'text-green-600',
    label: 'Okay',
    badge: 'bg-green-50 text-green-700 border-green-200',
  },
  slightly_high: {
    hex: '#fb923c',
    bg: 'bg-orange-400',
    text: 'text-orange-500',
    label: 'Slightly high',
    badge: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  high: {
    hex: '#ea580c',
    bg: 'bg-orange-600',
    text: 'text-orange-600',
    label: 'High',
    badge: 'bg-orange-100 text-orange-800 border-orange-300',
  },
};

export const SYMPTOM_OPTIONS = {
  hypo: [
    { id: 'shaky', label: 'Shaky' },
    { id: 'sweaty', label: 'Sweaty' },
    { id: 'hungry', label: 'Hungry' },
    { id: 'dizzy', label: 'Dizzy' },
    { id: 'confused', label: 'Confused' },
    { id: 'fast_heartbeat', label: 'Fast heartbeat' },
  ],
  hyper: [
    { id: 'thirsty', label: 'Thirsty' },
    { id: 'tired', label: 'Tired' },
    { id: 'blurry_vision', label: 'Blurry vision' },
    { id: 'frequent_urination', label: 'Frequent urination' },
    { id: 'headache', label: 'Headache' },
  ],
};

export const COMMON_FOOD_CHIPS = [
  'idly',
  'dosa',
  'rice',
  'chapathi',
  'dal/sambar',
  'curd',
  'egg',
  'tea/coffee',
];

export const DEFAULT_ACTIVITY_CHIPS = [
  { label: 'Morning run (5–10 km)', type: 'run' as ActivityType, duration: 45, intensity: 'moderate' as IntensityType },
  { label: 'Evening calisthenics (30–45 min)', type: 'calisthenics' as ActivityType, duration: 40, intensity: 'moderate' as IntensityType },
];

export const MEDICAL_DISCLAIMER =
  "Patterns derived from your own logs. This is not medical advice and does not replace glucose testing or your doctor's guidance.";
