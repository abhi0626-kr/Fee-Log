import { MealType } from '@/types';

export const TIMEZONE_IST = 'Asia/Kolkata';

/**
 * Returns current date in IST formatted as YYYY-MM-DD
 */
export function getTodayIST(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE_IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now); // en-CA outputs YYYY-MM-DD
}

/**
 * Returns current time in IST formatted as HH:mm
 */
export function getCurrentTimeIST(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE_IST,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.format(now);
}

/**
 * Gets the current hour in IST (0-23)
 */
export function getCurrentHourIST(): number {
  const timeStr = getCurrentTimeIST();
  const [hour] = timeStr.split(':').map(Number);
  return hour;
}

/**
 * Formats a YYYY-MM-DD date into readable IST string, e.g. "Thursday, Oct 22, 2026"
 */
export function formatISTDate(dateStr: string, options?: Intl.DateTimeFormatOptions): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: TIMEZONE_IST,
    weekday: options?.weekday ?? 'short',
    month: options?.month ?? 'short',
    day: options?.day ?? 'numeric',
    year: options?.year ?? 'numeric',
    ...options,
  }).format(date);
}

/**
 * Formats HH:mm or HH:mm:ss to 12-hour AM/PM format (e.g. "08:30 AM")
 */
export function formatISTTime(timeStr: string): string {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  const hour = parseInt(parts[0], 10);
  const minute = parseInt(parts[1] || '0', 10);
  
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  const displayMinute = minute < 10 ? `0${minute}` : `${minute}`;
  
  return `${displayHour}:${displayMinute} ${period}`;
}

/**
 * Converts HH:mm to minutes from midnight (0-1439)
 */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  const hour = parseInt(parts[0], 10) || 0;
  const minute = parseInt(parts[1], 10) || 0;
  return hour * 60 + minute;
}

/**
 * Converts minutes from midnight to HH:mm
 */
export function minutesToTime(totalMinutes: number): string {
  const hour = Math.floor(totalMinutes / 60) % 24;
  const minute = Math.floor(totalMinutes % 60);
  const hStr = hour < 10 ? `0${hour}` : `${hour}`;
  const mStr = minute < 10 ? `0${minute}` : `${minute}`;
  return `${hStr}:${mStr}`;
}

/**
 * Calculates absolute difference in minutes between two HH:mm strings
 */
export function timeDiffMinutes(timeA: string, timeB: string): number {
  return Math.abs(timeToMinutes(timeA) - timeToMinutes(timeB));
}

/**
 * Auto-defaults meal type based on IST hour:
 * <11 breakfast, 11–16 lunch, 16–19 snack, >19 dinner
 */
export function getDefaultMealTypeByHour(hour: number = getCurrentHourIST()): MealType {
  if (hour < 11) return 'breakfast';
  if (hour < 16) return 'lunch';
  if (hour < 19) return 'snack';
  return 'dinner';
}

/**
 * Calculates consecutive logging streak in local IST days
 * A streak is consecutive local days with >= 1 log of any type.
 */
export function calculateStreak(datesWithLogs: string[]): number {
  if (!datesWithLogs || datesWithLogs.length === 0) return 0;
  
  const uniqueDates = Array.from(new Set(datesWithLogs)).sort().reverse();
  const today = getTodayIST();
  
  // Find yesterday's date string
  const [y, m, d] = today.split('-').map(Number);
  const todayDateObj = new Date(Date.UTC(y, m - 1, d));
  const yesterdayObj = new Date(todayDateObj.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = yesterdayObj.toISOString().slice(0, 10);
  
  let currentExpectedDateObj: Date;
  let streak = 0;
  
  // If user logged today, streak starts from today.
  // If not logged today yet, streak can continue from yesterday if yesterday was logged!
  if (uniqueDates.includes(today)) {
    currentExpectedDateObj = todayDateObj;
  } else if (uniqueDates.includes(yesterdayStr)) {
    currentExpectedDateObj = yesterdayObj;
  } else {
    return 0; // Broken streak
  }
  
  while (true) {
    const expectedStr = currentExpectedDateObj.toISOString().slice(0, 10);
    if (uniqueDates.includes(expectedStr)) {
      streak += 1;
      currentExpectedDateObj = new Date(currentExpectedDateObj.getTime() - 24 * 60 * 60 * 1000);
    } else {
      break;
    }
  }
  
  return streak;
}

/**
 * Returns an array of date strings for the past N days in IST, sorted chronologically
 */
export function getPastDates(numDays: number): string[] {
  const dates: string[] = [];
  const today = getTodayIST();
  const [y, m, d] = today.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  
  for (let i = numDays - 1; i >= 0; i--) {
    const target = new Date(base.getTime() - i * 24 * 60 * 60 * 1000);
    dates.push(target.toISOString().slice(0, 10));
  }
  return dates;
}

/**
 * Shifts a YYYY-MM-DD date by offsetDays
 */
export function shiftDate(dateStr: string, offsetDays: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}
