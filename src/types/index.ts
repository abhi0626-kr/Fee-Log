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
  display_name: string;
  email?: string;
  avatar_url?: string;
  auth_provider?: 'google' | 'guest';
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

  activity_chips: string[];
  food_chips: string[];
}

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
