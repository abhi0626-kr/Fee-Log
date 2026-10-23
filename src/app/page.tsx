'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  getTodayIST,
  formatISTDate,
  formatISTTime,
  getCurrentTimeIST,
  calculateStreak,
} from '@/lib/date-utils';
import {
  getUnifiedLogsForDate,
  getInsulinLogs,
  getAllLoggedDates,
  getSettings,
  saveInsulinLog,
  saveFeelLog,
  deleteInsulinLog,
  deleteFoodLog,
  deleteActivityLog,
  deleteFeelLog,
  deleteGlucoseLog,
  seedRealisticPGData,
  DEFAULT_SETTINGS,
} from '@/lib/sync-storage';
import {
  UnifiedLogItem,
  UserSettings,
  InsulinLog,
  FoodLog,
  ActivityLog,
  FeelLog,
  GlucoseLog,
  FeelLevel,
  InsulinType,
} from '@/types';
import FoodSheet from '@/components/FoodSheet';
import ActivitySheet from '@/components/ActivitySheet';
import FeelSheet from '@/components/FeelSheet';
import GlucoseSheet from '@/components/GlucoseSheet';
import InsulinSheet from '@/components/InsulinSheet';
import DeleteConfirmModal from '@/components/DeleteConfirmModal';

interface FeelConfig {
  id: FeelLevel;
  emoji: string;
  title: string;
  subtitle: string;
  dotColor: string;
  glowColor: string;
  symptoms: string[];
}

const FEEL_CONFIGS: Record<FeelLevel, FeelConfig> = {
  low: {
    id: 'low',
    emoji: '📉',
    title: 'Low',
    subtitle: 'Under ~70 mg/dL feeling',
    dotColor: 'bg-error shadow-[0_0_8px_rgba(255,180,171,0.8)]',
    glowColor: 'rgba(255,180,171,0.2)',
    symptoms: ['Shaky', 'Cold Sweats', 'Dizziness', 'Sudden Hunger', 'Brain Fog', 'Fast Pulse'],
  },
  slightly_low: {
    id: 'slightly_low',
    emoji: '🔻',
    title: 'Slightly Low',
    subtitle: 'Dipping early signs',
    dotColor: 'bg-tertiary shadow-[0_0_8px_rgba(255,185,95,0.8)]',
    glowColor: 'rgba(255,185,95,0.2)',
    symptoms: ['Mild Tremor', 'Yawning', 'Heavy Legs', 'Anxious Sensation', 'Light Sweating'],
  },
  okay: {
    id: 'okay',
    emoji: '✨',
    title: 'Okay',
    subtitle: 'Balanced & In-Range',
    dotColor: 'bg-primary shadow-[0_0_12px_rgba(78,222,163,0.9)]',
    glowColor: 'rgba(78,222,163,0.2)',
    symptoms: ['High Energy', 'Clear Head', 'Good Focus', 'Calm Pulse', 'Post-Run Endorphins'],
  },
  slightly_high: {
    id: 'slightly_high',
    emoji: '☕',
    title: 'Slightly High',
    subtitle: 'Post-meal elevation',
    dotColor: 'bg-tertiary-container shadow-[0_0_10px_rgba(226,145,0,0.8)]',
    glowColor: 'rgba(226,145,0,0.25)',
    symptoms: ['Sluggish', 'Mild Thirst', 'Heavy Eyes', 'PG Mess Rice Aftermath', 'Restless', 'Headache'],
  },
  high: {
    id: 'high',
    emoji: '🔥',
    title: 'High',
    subtitle: 'Significant spike',
    dotColor: 'bg-tertiary-container shadow-[0_0_12px_rgba(226,145,0,0.9)]',
    glowColor: 'rgba(226,145,0,0.3)',
    symptoms: ['Extreme Thirst', 'Dry Mouth', 'Very Heavy Eyes', 'Brain Fog', 'Frequent Urination', 'Fatigue'],
  },
};

export default function QuickLogPage() {
  const [mounted, setMounted] = useState<boolean>(false);
  const [todayStr] = useState<string>(getTodayIST());
  const [todayLogs, setTodayLogs] = useState<UnifiedLogItem[]>([]);
  const [todayInsulinLogs, setTodayInsulinLogs] = useState<InsulinLog[]>([]);
  const [streak, setStreak] = useState<number>(0);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);

  // Dynamic day-to-day adjustable dose units
  const [morningUnits, setMorningUnits] = useState<number>(20);
  const [afternoonUnits, setAfternoonUnits] = useState<number>(10);
  const [nightUnits, setNightUnits] = useState<number>(25);

  // Sensory Feel Deck state
  const [selectedFeel, setSelectedFeel] = useState<FeelLevel>('slightly_high');
  const [selectedChips, setSelectedChips] = useState<string[]>(['Sluggish', 'Mild Thirst']);
  const [feelNote, setFeelNote] = useState<string>('After PG mess lunch + sweet filter coffee at canteen');
  const [feelSavedToast, setFeelSavedToast] = useState<string | null>(null);

  // Modal Sheet states
  const [isFoodOpen, setIsFoodOpen] = useState(false);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [isFeelOpen, setIsFeelOpen] = useState(false);
  const [isGlucoseOpen, setIsGlucoseOpen] = useState(false);
  const [isInsulinOpen, setIsInsulinOpen] = useState(false);
  const [insulinModalType, setInsulinModalType] = useState<InsulinType>('morning_regular');

  // Editing targets
  const [editingFood, setEditingFood] = useState<FoodLog | null>(null);
  const [editingActivity, setEditingActivity] = useState<ActivityLog | null>(null);
  const [editingFeel, setEditingFeel] = useState<FeelLog | null>(null);
  const [editingGlucose, setEditingGlucose] = useState<GlucoseLog | null>(null);
  const [editingInsulin, setEditingInsulin] = useState<InsulinLog | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UnifiedLogItem | null>(null);

  const refreshData = useCallback(() => {
    const logs = getUnifiedLogsForDate(todayStr);
    setTodayLogs(logs);

    const insulin = getInsulinLogs().filter((l) => l.log_date === todayStr);
    setTodayInsulinLogs(insulin);

    const allDates = getAllLoggedDates();
    const st = calculateStreak(allDates);
    setStreak(st);

    const currentSettings = getSettings();
    setSettings(currentSettings);

    // Sync unit steppers with existing logs if already taken today, else fallback to settings defaults
    const morning = insulin.find((l) => l.insulin_type === 'morning_regular');
    if (morning) setMorningUnits(morning.units);
    else setMorningUnits(currentSettings.morning_regular_units);

    const afternoon = insulin.find((l) => l.insulin_type === 'afternoon_regular');
    if (afternoon) setAfternoonUnits(afternoon.units);
    else setAfternoonUnits(currentSettings.afternoon_regular_units ?? 10);

    const night = insulin.find((l) => l.insulin_type === 'night_30_70');
    if (night) setNightUnits(night.units);
    else setNightUnits(currentSettings.night_30_70_units);
  }, [todayStr]);

  useEffect(() => {
    setMounted(true);
    refreshData();

    const handleOpenQuickLog = () => {
      const el = document.getElementById('feel-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    };
    window.addEventListener('open-quick-log', handleOpenQuickLog);
    window.addEventListener('t1d-data-updated', refreshData);
    return () => {
      window.removeEventListener('open-quick-log', handleOpenQuickLog);
      window.removeEventListener('t1d-data-updated', refreshData);
    };
  }, [refreshData]);

  const morningLog = mounted ? todayInsulinLogs.find((l) => l.insulin_type === 'morning_regular') : undefined;
  const afternoonLog = mounted ? todayInsulinLogs.find((l) => l.insulin_type === 'afternoon_regular') : undefined;
  const nightLog = mounted ? todayInsulinLogs.find((l) => l.insulin_type === 'night_30_70') : undefined;
  const extraCorrectionLogs = mounted ? todayInsulinLogs.filter((l) => l.insulin_type === 'correction' || l.insulin_type === 'other') : [];

  // Toggle or save dose with chosen units and actual current time
  const handleToggleInsulinDose = (type: InsulinType, chosenUnits: number) => {
    const existing = todayInsulinLogs.find((l) => l.insulin_type === type);
    if (existing) {
      deleteInsulinLog(existing.id);
    } else {
      const actualCurrentTime = getCurrentTimeIST();
      const defaultNote =
        type === 'morning_regular'
          ? (settings.morning_meal_note || 'Administered before breakfast')
          : type === 'afternoon_regular'
          ? (settings.midday_meal_note || 'Midday dose before lunch based on body condition')
          : (settings.night_meal_note || 'Administered before dinner');

      saveInsulinLog({
        user_id: 'user-1',
        log_date: todayStr,
        log_time: actualCurrentTime,
        insulin_type: type,
        units: chosenUnits,
        taken: true,
        note: defaultNote,
      });
    }
    refreshData();
  };

  // Immediate unit adjustment for already-taken doses
  const handleUpdateLoggedUnits = (existingLog: InsulinLog, newUnits: number) => {
    if (newUnits <= 0) return;
    saveInsulinLog({
      ...existingLog,
      units: newUnits,
    });
    refreshData();
  };

  // Immediate time adjustment for already-taken doses
  const handleUpdateLoggedTime = (existingLog: InsulinLog, newTime: string) => {
    if (!newTime) return;
    saveInsulinLog({
      ...existingLog,
      log_time: newTime,
    });
    refreshData();
  };

  // Select Feel state
  const handleSelectFeel = (level: FeelLevel) => {
    setSelectedFeel(level);
    const cfg = FEEL_CONFIGS[level];
    setSelectedChips(cfg.symptoms.slice(0, 2));
  };

  const handleToggleChip = (chip: string) => {
    setSelectedChips((prev) =>
      prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip]
    );
  };

  const handleSaveSensoryFeel = () => {
    saveFeelLog({
      user_id: 'user-1',
      log_date: todayStr,
      log_time: getCurrentTimeIST(),
      feel: selectedFeel,
      symptoms: selectedChips,
      note: feelNote.trim() || null,
    });
    setFeelSavedToast(`Logged: ${FEEL_CONFIGS[selectedFeel].title} state recorded!`);
    setTimeout(() => setFeelSavedToast(null), 3000);
    refreshData();
  };

  const handleDeleteConfirmed = () => {
    if (!deleteTarget) return;
    if (deleteTarget.category === 'insulin') deleteInsulinLog(deleteTarget.id);
    else if (deleteTarget.category === 'food') deleteFoodLog(deleteTarget.id);
    else if (deleteTarget.category === 'activity') deleteActivityLog(deleteTarget.id);
    else if (deleteTarget.category === 'feel') deleteFeelLog(deleteTarget.id);
    else if (deleteTarget.category === 'glucose') deleteGlucoseLog(deleteTarget.id);

    setDeleteTarget(null);
    refreshData();
  };

  const handleEditItem = (item: UnifiedLogItem) => {
    if (item.category === 'insulin' && item.insulin) {
      setInsulinModalType(item.insulin.insulin_type);
      setEditingInsulin(item.insulin);
      setIsInsulinOpen(true);
    } else if (item.category === 'food' && item.food) {
      setEditingFood(item.food);
      setIsFoodOpen(true);
    } else if (item.category === 'activity' && item.activity) {
      setEditingActivity(item.activity);
      setIsActivityOpen(true);
    } else if (item.category === 'feel' && item.feel) {
      setEditingFeel(item.feel);
      setIsFeelOpen(true);
    } else if (item.category === 'glucose' && item.glucose) {
      setEditingGlucose(item.glucose);
      setIsGlucoseOpen(true);
    }
  };

  const totalDosesLogged = todayInsulinLogs.filter((l) => l.taken).length;
  const feelsCount = todayLogs.filter((l) => l.category === 'feel').length;
  const activityItems = todayLogs.filter((l) => l.category === 'activity');

  return (
    <div className="max-w-[1240px] mx-auto px-3 sm:px-6 lg:px-8 flex flex-col gap-4 sm:gap-6">
      {/* 1. TOP OVERVIEW BAR */}
      <section className="w-full">
        <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 sm:gap-4 p-4 sm:p-5 md:p-6 rounded-2xl sm:rounded-3xl bg-surface-container-low/70 backdrop-blur-xl border border-surface-container-high/50 shadow-xl shadow-surface-container-lowest/40">
          {/* Date, Identity & Bangalore Context */}
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-surface-container flex items-center justify-center text-primary shadow-inner shrink-0 border border-primary/20">
              <span className="material-symbols-outlined text-[1.4rem] sm:text-[1.75rem]" style={{ fontVariationSettings: "'FILL' 1" }}>
                calendar_today
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span className="font-headline-sm text-sm sm:text-headline-sm text-on-surface font-bold tracking-tight">
                  <span className="hidden sm:inline">
                    {formatISTDate(todayStr, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <span className="sm:hidden">
                    {formatISTDate(todayStr, { weekday: 'short', day: 'numeric', month: 'short' })}
                  </span>
                </span>
                <span className="text-outline-variant font-label-md text-xs">·</span>
                <span className="font-label-md text-[11px] sm:text-xs text-secondary font-semibold truncate">
                  {settings.city || 'Bangalore'} ({settings.timezone?.includes('Kolkata') ? 'IST' : settings.timezone || 'IST'})
                </span>
                <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[0.65rem] sm:text-[0.7rem] font-bold tracking-wide border border-primary/20 shrink-0">
                  {streak > 0 ? `🔥 ${streak}d Streak` : '🔥 0d'}
                </span>
              </div>

              {/* Mobile Compact Identity & Regimen */}
              <div className="flex items-center gap-1.5 mt-1 sm:hidden flex-wrap text-xs">
                <span className="font-bold text-on-surface truncate max-w-[140px]">
                  {settings.display_name || 'You'}
                </span>
                <span className="text-outline-variant">·</span>
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold text-[10px] border border-primary/20 shrink-0">
                  ⚡ 2–3 Doses/Day
                </span>
                {settings.lifestyle_note && (
                  <span className="text-[10px] text-on-surface-variant truncate max-w-[120px]" title={settings.lifestyle_note}>
                    ({settings.lifestyle_note})
                  </span>
                )}
              </div>

              {/* Desktop Full Context */}
              <p className="hidden sm:flex font-body-md text-sm text-on-surface-variant items-center gap-2 mt-0.5">
                <span className="font-bold text-on-surface">{settings.display_name ? `${settings.display_name} · ` : ''}</span>
                <span>{settings.lifestyle_note || 'Flexible diabetes routine'}</span>
                <span className="text-outline-variant">·</span>
                <span className="text-primary font-medium">Flexible 2–3 Doses / Day Regimen</span>
              </p>
            </div>
          </div>

          {/* Telemetry Summary Chips (3-column on mobile, inline flex on desktop) */}
          <div className="grid grid-cols-3 gap-2 w-full xl:w-auto xl:flex xl:items-center">
            <button
              onClick={() => {
                const el = document.getElementById('insulin-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              type="button"
              className="flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-xl sm:rounded-full bg-surface-container-high/60 hover:bg-surface-container-high border border-white/5 backdrop-blur-md transition-all text-center sm:text-left cursor-pointer"
            >
              <span className="material-symbols-outlined text-primary text-[1rem] sm:text-[1.125rem] shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
                vaccines
              </span>
              <div className="flex flex-col text-left truncate">
                <span className="font-label-md text-[11px] sm:text-xs text-on-surface font-bold leading-none truncate">
                  {totalDosesLogged} Dose{totalDosesLogged === 1 ? '' : 's'}
                </span>
                <span className="text-[0.65rem] text-on-surface-variant leading-tight hidden sm:block truncate">
                  {totalDosesLogged === 0
                    ? 'Pending doses'
                    : totalDosesLogged === 1
                    ? `${morningLog ? 'Morning' : afternoonLog ? 'Midday' : 'Night'} done`
                    : totalDosesLogged === 2
                    ? '2 doses logged'
                    : `${totalDosesLogged} doses taken today`}
                </span>
              </div>
            </button>

            <button
              onClick={() => {
                const el = document.getElementById('feel-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
                else setIsFeelOpen(true);
              }}
              type="button"
              className="flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-xl sm:rounded-full bg-surface-container-high/60 hover:bg-surface-container-high border border-white/5 backdrop-blur-md transition-all text-center sm:text-left cursor-pointer"
            >
              <span className="material-symbols-outlined text-tertiary text-[1rem] sm:text-[1.125rem] shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
                mood
              </span>
              <div className="flex flex-col text-left truncate">
                <span className="font-label-md text-[11px] sm:text-xs text-on-surface font-bold leading-none truncate">
                  {feelsCount} Feel{feelsCount === 1 ? '' : 's'}
                </span>
                <span className="text-[0.65rem] text-tertiary leading-tight hidden sm:block truncate">
                  {feelsCount > 0 ? 'Recorded today' : 'No feel log yet'}
                </span>
              </div>
            </button>

            <button
              onClick={() => {
                setEditingActivity(null);
                setIsActivityOpen(true);
              }}
              type="button"
              className="flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-xl sm:rounded-full bg-surface-container-high/60 hover:bg-surface-container-high border border-white/5 backdrop-blur-md transition-all text-center sm:text-left group cursor-pointer"
            >
              <span className="material-symbols-outlined text-secondary text-[1rem] sm:text-[1.125rem] shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
                directions_run
              </span>
              <div className="flex flex-col text-left truncate">
                <span className="font-label-md text-[11px] sm:text-xs text-on-surface font-bold leading-none truncate">
                  {activityItems.length > 0
                    ? `${activityItems[0].activity?.duration_min}m`
                    : '0 Run'}
                </span>
                <span className="text-[0.65rem] text-on-surface-variant leading-tight hidden sm:block truncate">
                  {activityItems.length > 0
                    ? `${activityItems.length} session${activityItems.length > 1 ? 's' : ''} logged`
                    : 'No run/workout yet'}
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Optional Glucose Zero-Pressure Glass Ribbon */}
        <div className="mt-2.5 px-3 sm:px-4 py-2 rounded-xl sm:rounded-full bg-surface-container-lowest/80 border border-white/5 backdrop-blur-md flex items-center justify-between gap-2 text-on-surface-variant text-xs shadow-sm">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <span className="material-symbols-outlined text-secondary text-[1rem] shrink-0">bloodtype</span>
            <span className="text-on-surface font-bold shrink-0">
              <span className="hidden sm:inline">Optional Reading:</span>
              <span className="sm:hidden">Meter / Lab:</span>
            </span>
            <span className="text-[11px] truncate text-on-surface-variant">
              <span className="hidden sm:inline">Got a fingerstick or lab number today?</span>
              <span className="sm:hidden">Optional mg/dL</span>
            </span>
          </div>
          <button
            onClick={() => {
              setEditingGlucose(null);
              setIsGlucoseOpen(true);
            }}
            className="flex items-center gap-1 px-3 py-1 rounded-full bg-surface-container hover:bg-surface-container-high text-secondary hover:text-on-surface transition-all active:scale-95 text-xs font-semibold shadow-inner border border-secondary/20 shrink-0"
            type="button"
          >
            <span className="material-symbols-outlined text-[0.875rem]">add</span>
            <span className="hidden sm:inline">Add Meter Value</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </section>

      {/* 2. DYNAMIC PRE-FILLED INSULIN DOSAGE CARDS (SUPPORTS 2-3+ DOSES / DAY & ADJUSTABLE UNITS) */}
      <section id="insulin-section" className="space-y-3">
        <div className="flex items-center justify-between px-1 gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <span className="material-symbols-outlined text-primary text-base shrink-0">vaccines</span>
            <span className="font-headline-sm text-sm text-on-surface font-bold truncate">
              Today&apos;s Doses
            </span>
            <span className="hidden sm:inline text-xs text-on-surface-variant font-medium">
              (Adjust units anytime based on your body condition)
            </span>
            <span className="sm:hidden text-[10px] text-on-surface-variant" title="Tap units anytime to adjust">
              ℹ️
            </span>
          </div>
          <button
            onClick={() => {
              setInsulinModalType('correction');
              setEditingInsulin(null);
              setIsInsulinOpen(true);
            }}
            className="flex items-center gap-1 px-3 py-1 rounded-full bg-surface-container-high hover:bg-surface-bright text-secondary text-xs font-semibold transition-all border border-secondary/20 shrink-0"
            type="button"
          >
            <span className="material-symbols-outlined text-[1rem]">add</span>
            <span className="hidden sm:inline">+ Extra Correction Dose</span>
            <span className="sm:hidden">+ Correction</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          {/* Card 1: Morning Regimen */}
          <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-surface-container-low/80 backdrop-blur-xl p-4 sm:p-5 border border-primary/20 shadow-xl shadow-surface-container-lowest/50 flex flex-col justify-between transition-all group">
            <div className="absolute -right-8 -top-8 w-24 h-24 bg-primary/10 rounded-full blur-2xl pointer-events-none"></div>
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${morningLog ? 'bg-primary shadow-[0_0_12px_rgba(78,222,163,0.8)]' : 'bg-outline'}`}></span>
                  <span className="font-label-md text-xs text-primary uppercase font-bold tracking-wider">
                    Morning Dose
                  </span>
                </div>
                {morningLog ? (
                  <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 rounded-full bg-primary-container/20 text-primary border border-primary/20 font-label-md text-[0.65rem] sm:text-[0.7rem] font-bold">
                    <span className="material-symbols-outlined text-[0.8rem] sm:text-[0.875rem]">schedule</span>
                    <span className="hidden sm:inline">Taken at</span>
                    <input
                      type="time"
                      value={morningLog.log_time}
                      onChange={(e) => handleUpdateLoggedTime(morningLog, e.target.value)}
                      className="bg-transparent text-primary font-bold focus:outline-none cursor-pointer border-b border-primary/40 px-0.5 text-xs"
                      title="Adjust injection time"
                    />
                  </div>
                ) : (
                  <span className="px-2 sm:px-2.5 py-0.5 rounded-full font-label-md text-[0.65rem] sm:text-[0.7rem] font-semibold bg-surface-container-high text-on-surface-variant">
                    Target {formatISTTime(settings.morning_target_time || '08:00')}
                  </span>
                )}
              </div>

              <h2 className="font-headline-sm text-sm sm:text-base text-on-surface font-bold mt-1">
                {settings.morning_insulin_brand || 'Regular (R)'} Insulin
              </h2>
              <p className="font-body-md text-[11px] sm:text-xs text-on-surface-variant line-clamp-1">
                {settings.morning_meal_note || 'Before PG breakfast (Idly / Dosa)'}
              </p>

              {/* Day-to-Day Inline Unit Stepper */}
              <div className="mt-3 sm:mt-4 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-surface-container/70 border border-white/5 flex items-center justify-between">
                <span className="text-xs text-on-surface-variant font-medium">
                  <span className="hidden sm:inline">Dose Units:</span>
                  <span className="sm:hidden">Units:</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const next = Math.max(1, morningUnits - 1);
                      setMorningUnits(next);
                      if (morningLog) handleUpdateLoggedUnits(morningLog, next);
                    }}
                    type="button"
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-surface-container-high hover:bg-surface-bright text-on-surface flex items-center justify-center font-bold text-sm sm:text-base shadow-sm"
                    title="Decrease 1 unit"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={morningUnits}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setMorningUnits(val);
                      if (morningLog) handleUpdateLoggedUnits(morningLog, val);
                    }}
                    className="w-12 sm:w-14 text-center font-label-numeric text-lg sm:text-xl text-primary font-extrabold bg-transparent border-b border-primary/40 focus:outline-none"
                  />
                  <button
                    onClick={() => {
                      const next = morningUnits + 1;
                      setMorningUnits(next);
                      if (morningLog) handleUpdateLoggedUnits(morningLog, next);
                    }}
                    type="button"
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-surface-container-high hover:bg-surface-bright text-on-surface flex items-center justify-center font-bold text-sm sm:text-base shadow-sm"
                    title="Increase 1 unit"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-3 sm:pt-4 mt-3 sm:mt-4 border-t border-surface-container-high/40 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 text-primary font-label-md text-xs font-semibold">
                <span className="material-symbols-outlined text-[1rem] sm:text-[1.125rem]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {morningLog ? 'check_circle' : 'schedule'}
                </span>
                <span>{morningLog ? 'Logged ✓' : 'Scheduled'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {morningLog ? (
                  <>
                    <button
                      onClick={() => {
                        setInsulinModalType('morning_regular');
                        setEditingInsulin(morningLog);
                        setIsInsulinOpen(true);
                      }}
                      className="px-2.5 py-1 rounded-full bg-surface-container-high hover:bg-surface-bright text-on-surface-variant hover:text-on-surface text-xs font-semibold"
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleToggleInsulinDose('morning_regular', morningUnits)}
                      className="w-7 h-7 rounded-full bg-primary/20 text-primary hover:bg-error/20 hover:text-error flex items-center justify-center transition-colors"
                      title="Untake dose"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-sm">done_all</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleToggleInsulinDose('morning_regular', morningUnits)}
                    className="flex items-center gap-1 px-3 sm:px-3.5 py-1.5 rounded-full bg-primary text-on-primary font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-sm sm:text-base">alarm_on</span>
                    <span className="hidden sm:inline">Mark as Taken</span>
                    <span className="sm:hidden">Take Dose</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Card 2: Afternoon / Midday Dose (Based on Body Condition / Lunch Spike) */}
          <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-surface-container-low/80 backdrop-blur-xl p-4 sm:p-5 border border-tertiary/20 shadow-xl shadow-surface-container-lowest/50 flex flex-col justify-between transition-all group">
            <div className="absolute -right-8 -top-8 w-24 h-24 bg-tertiary/10 rounded-full blur-2xl pointer-events-none"></div>
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${afternoonLog ? 'bg-tertiary shadow-[0_0_12px_rgba(255,185,95,0.8)]' : 'bg-outline'}`}></span>
                  <span className="font-label-md text-xs text-tertiary uppercase font-bold tracking-wider">
                    Midday Dose
                  </span>
                </div>
                {afternoonLog ? (
                  <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 rounded-full bg-tertiary-container/20 text-tertiary border border-tertiary/20 font-label-md text-[0.65rem] sm:text-[0.7rem] font-bold">
                    <span className="material-symbols-outlined text-[0.8rem] sm:text-[0.875rem]">schedule</span>
                    <span className="hidden sm:inline">Taken at</span>
                    <input
                      type="time"
                      value={afternoonLog.log_time}
                      onChange={(e) => handleUpdateLoggedTime(afternoonLog, e.target.value)}
                      className="bg-transparent text-tertiary font-bold focus:outline-none cursor-pointer border-b border-tertiary/40 px-0.5 text-xs"
                      title="Adjust injection time"
                    />
                  </div>
                ) : (
                  <span className="px-2 sm:px-2.5 py-0.5 rounded-full font-label-md text-[0.65rem] sm:text-[0.7rem] font-semibold bg-surface-container-high text-on-surface-variant">
                    Target {formatISTTime(settings.midday_target_time || '13:30')}
                  </span>
                )}
              </div>

              <h2 className="font-headline-sm text-sm sm:text-base text-on-surface font-bold mt-1">
                {settings.midday_insulin_brand || 'Regular (R)'} Insulin
              </h2>
              <p className="font-body-md text-[11px] sm:text-xs text-on-surface-variant line-clamp-1">
                {settings.midday_meal_note || 'Based on PG mess rice carb load or high feel'}
              </p>

              {/* Day-to-Day Inline Unit Stepper */}
              <div className="mt-3 sm:mt-4 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-surface-container/70 border border-white/5 flex items-center justify-between">
                <span className="text-xs text-on-surface-variant font-medium">
                  <span className="hidden sm:inline">Dose Units:</span>
                  <span className="sm:hidden">Units:</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const next = Math.max(1, afternoonUnits - 1);
                      setAfternoonUnits(next);
                      if (afternoonLog) handleUpdateLoggedUnits(afternoonLog, next);
                    }}
                    type="button"
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-surface-container-high hover:bg-surface-bright text-on-surface flex items-center justify-center font-bold text-sm sm:text-base shadow-sm"
                    title="Decrease 1 unit"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={afternoonUnits}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setAfternoonUnits(val);
                      if (afternoonLog) handleUpdateLoggedUnits(afternoonLog, val);
                    }}
                    className="w-12 sm:w-14 text-center font-label-numeric text-lg sm:text-xl text-tertiary font-extrabold bg-transparent border-b border-tertiary/40 focus:outline-none"
                  />
                  <button
                    onClick={() => {
                      const next = afternoonUnits + 1;
                      setAfternoonUnits(next);
                      if (afternoonLog) handleUpdateLoggedUnits(afternoonLog, next);
                    }}
                    type="button"
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-surface-container-high hover:bg-surface-bright text-on-surface flex items-center justify-center font-bold text-sm sm:text-base shadow-sm"
                    title="Increase 1 unit"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-3 sm:pt-4 mt-3 sm:mt-4 border-t border-surface-container-high/40 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 text-tertiary font-label-md text-xs font-semibold">
                <span className="material-symbols-outlined text-[1rem] sm:text-[1.125rem]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {afternoonLog ? 'check_circle' : 'psychology_alt'}
                </span>
                <span>{afternoonLog ? 'Logged ✓' : '3rd Dose Option'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {afternoonLog ? (
                  <>
                    <button
                      onClick={() => {
                        setInsulinModalType('afternoon_regular');
                        setEditingInsulin(afternoonLog);
                        setIsInsulinOpen(true);
                      }}
                      className="px-2.5 py-1 rounded-full bg-surface-container-high hover:bg-surface-bright text-on-surface-variant hover:text-on-surface text-xs font-semibold"
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleToggleInsulinDose('afternoon_regular', afternoonUnits)}
                      className="w-7 h-7 rounded-full bg-tertiary/20 text-tertiary hover:bg-error/20 hover:text-error flex items-center justify-center transition-colors"
                      title="Untake dose"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-sm">done_all</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleToggleInsulinDose('afternoon_regular', afternoonUnits)}
                    className="flex items-center gap-1 px-3 sm:px-3.5 py-1.5 rounded-full bg-tertiary-container hover:bg-tertiary text-on-tertiary font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-sm sm:text-base">alarm_on</span>
                    <span className="hidden sm:inline">Mark as Taken</span>
                    <span className="sm:hidden">Take Dose</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Card 3: Scheduled Tonight (30/70 Biphasic) */}
          <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-surface-container-low/80 backdrop-blur-xl p-4 sm:p-5 border border-secondary/20 shadow-xl shadow-surface-container-lowest/50 flex flex-col justify-between transition-all group">
            <div className="absolute -right-8 -top-8 w-24 h-24 bg-secondary/15 rounded-full blur-2xl pointer-events-none"></div>
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${nightLog ? 'bg-secondary' : 'bg-secondary animate-pulse shadow-[0_0_12px_rgba(76,215,246,0.8)]'}`}></span>
                  <span className="font-label-md text-xs text-secondary uppercase font-bold tracking-wider">
                    Night Regimen
                  </span>
                </div>
                {nightLog ? (
                  <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 rounded-full bg-secondary-container/20 text-secondary border border-secondary/20 font-label-md text-[0.65rem] sm:text-[0.7rem] font-bold">
                    <span className="material-symbols-outlined text-[0.8rem] sm:text-[0.875rem]">schedule</span>
                    <span className="hidden sm:inline">Taken at</span>
                    <input
                      type="time"
                      value={nightLog.log_time}
                      onChange={(e) => handleUpdateLoggedTime(nightLog, e.target.value)}
                      className="bg-transparent text-secondary font-bold focus:outline-none cursor-pointer border-b border-secondary/40 px-0.5 text-xs"
                      title="Adjust injection time"
                    />
                  </div>
                ) : (
                  <span className="px-2 sm:px-2.5 py-0.5 rounded-full font-label-md text-[0.65rem] sm:text-[0.7rem] font-semibold bg-surface-container-high text-on-surface-variant">
                    Target {formatISTTime(settings.night_target_time || '20:30')}
                  </span>
                )}
              </div>

              <h2 className="font-headline-sm text-sm sm:text-base text-on-surface font-bold mt-1">
                {settings.night_insulin_brand || '30/70 Biphasic Mix'}
              </h2>
              <p className="font-body-md text-[11px] sm:text-xs text-on-surface-variant line-clamp-1">
                {settings.night_meal_note || '15m before PG dinner (Chapati / Rice)'}
              </p>

              {/* Day-to-Day Inline Unit Stepper */}
              <div className="mt-3 sm:mt-4 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-surface-container/70 border border-white/5 flex items-center justify-between">
                <span className="text-xs text-on-surface-variant font-medium">
                  <span className="hidden sm:inline">Dose Units:</span>
                  <span className="sm:hidden">Units:</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const next = Math.max(1, nightUnits - 1);
                      setNightUnits(next);
                      if (nightLog) handleUpdateLoggedUnits(nightLog, next);
                    }}
                    type="button"
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-surface-container-high hover:bg-surface-bright text-on-surface flex items-center justify-center font-bold text-sm sm:text-base shadow-sm"
                    title="Decrease 1 unit"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={nightUnits}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setNightUnits(val);
                      if (nightLog) handleUpdateLoggedUnits(nightLog, val);
                    }}
                    className="w-12 sm:w-14 text-center font-label-numeric text-lg sm:text-xl text-secondary font-extrabold bg-transparent border-b border-secondary/40 focus:outline-none"
                  />
                  <button
                    onClick={() => {
                      const next = nightUnits + 1;
                      setNightUnits(next);
                      if (nightLog) handleUpdateLoggedUnits(nightLog, next);
                    }}
                    type="button"
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-surface-container-high hover:bg-surface-bright text-on-surface flex items-center justify-center font-bold text-sm sm:text-base shadow-sm"
                    title="Increase 1 unit"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-3 sm:pt-4 mt-3 sm:mt-4 border-t border-surface-container-high/40 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 text-secondary font-label-md text-xs font-semibold">
                <span className="material-symbols-outlined text-[1rem] sm:text-[1.125rem]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {nightLog ? 'check_circle' : 'schedule'}
                </span>
                <span>{nightLog ? 'Logged ✓' : 'Scheduled'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {nightLog ? (
                  <>
                    <button
                      onClick={() => {
                        setInsulinModalType('night_30_70');
                        setEditingInsulin(nightLog);
                        setIsInsulinOpen(true);
                      }}
                      className="px-2.5 py-1 rounded-full bg-surface-container-high hover:bg-surface-bright text-on-surface-variant hover:text-on-surface text-xs font-semibold"
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleToggleInsulinDose('night_30_70', nightUnits)}
                      className="w-7 h-7 rounded-full bg-secondary/20 text-secondary hover:bg-error/20 hover:text-error flex items-center justify-center transition-colors"
                      title="Untake dose"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-sm">done_all</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleToggleInsulinDose('night_30_70', nightUnits)}
                    className="flex items-center gap-1 px-3 sm:px-3.5 py-1.5 rounded-full bg-secondary-container hover:bg-secondary text-on-secondary-container hover:text-on-secondary font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-sm sm:text-base">alarm_on</span>
                    <span className="hidden sm:inline">Mark as Taken</span>
                    <span className="sm:hidden">Take Dose</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Extra Correction Doses list if taken */}
        {extraCorrectionLogs.length > 0 && (
          <div className="p-3 rounded-2xl bg-surface-container-lowest/70 border border-white/5 flex items-center justify-between gap-2 flex-wrap text-xs">
            <span className="text-secondary font-semibold">Additional Doses Taken Today:</span>
            <div className="flex items-center gap-2 flex-wrap">
              {extraCorrectionLogs.map((cLog) => (
                <div key={cLog.id} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-high text-on-surface border border-white/5">
                  <span className="font-bold text-secondary">{cLog.units}U</span>
                  <span className="text-[0.7rem] text-on-surface-variant">({formatISTTime(cLog.log_time)})</span>
                  <button
                    onClick={() => {
                      setInsulinModalType(cLog.insulin_type);
                      setEditingInsulin(cLog);
                      setIsInsulinOpen(true);
                    }}
                    className="hover:text-primary transition-colors ml-1"
                    title="Edit correction"
                  >
                    ✎
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 3. FEEL TRACKER (HERO 5-SECOND LOGGING DECK) */}
      <section
        id="feel-section"
        className="rounded-2xl sm:rounded-3xl bg-surface-container-low/70 backdrop-blur-2xl p-4 sm:p-5 md:p-8 border border-white/5 shadow-2xl shadow-surface-container-lowest/60 relative overflow-hidden"
      >
        {/* Dynamic Ambient Backing Splash */}
        <div
          className="absolute -top-20 -left-20 w-96 h-96 rounded-full blur-[120px] pointer-events-none transition-all duration-700"
          style={{ backgroundColor: FEEL_CONFIGS[selectedFeel].glowColor }}
        ></div>

        {/* Section Title & Intent */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6 relative z-10">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-primary text-[1.125rem]">vital_signs</span>
              <span className="font-label-md text-[10px] sm:text-xs uppercase font-bold tracking-widest text-primary">
                <span className="hidden sm:inline">Sensory Metabolic Feedback</span>
                <span className="sm:hidden">Sensation Check</span>
              </span>
            </div>
            <h2 className="font-headline-xl text-lg sm:text-headline-xl text-on-surface font-bold tracking-tight">
              How does your body feel right now?
            </h2>
            <p className="font-body-md text-xs sm:text-sm text-on-surface-variant">
              <span className="hidden sm:inline">Tap once to log in under 5 seconds. Designed for zero mental fatigue &amp; no finger prick needed.</span>
              <span className="sm:hidden">Tap once to record rhythm · Zero prick</span>
            </p>
          </div>

          {/* Live Timestamp Slot */}
          <div className="flex items-center gap-1.5 sm:gap-2 px-3 py-1 sm:px-4 sm:py-1.5 rounded-full bg-surface-container-lowest text-on-surface-variant font-label-md text-[11px] sm:text-xs border border-white/5 shadow-inner shrink-0">
            <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
            <span className="text-on-surface font-semibold hidden sm:inline">Active Slot:</span>
            <span>Just now ({formatISTTime(getCurrentTimeIST())})</span>
          </div>
        </div>

        {/* The 5 Neumorphic Extruded Feel States (Horizontal Arc) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-4 mb-4 sm:mb-6 relative z-10">
          {(Object.keys(FEEL_CONFIGS) as FeelLevel[]).map((level) => {
            const cfg = FEEL_CONFIGS[level];
            const isActive = selectedFeel === level;
            return (
              <button
                key={level}
                onClick={() => handleSelectFeel(level)}
                type="button"
                className={`relative text-left p-3 sm:p-4 rounded-xl sm:rounded-2xl transition-all duration-300 flex flex-col justify-between h-32 sm:h-44 group cursor-pointer overflow-hidden border ${
                  isActive
                    ? 'bg-surface-container-high border-tertiary/40 ring-2 ring-tertiary/50 shadow-xl shadow-tertiary/10 scale-[1.02]'
                    : 'bg-surface-container/70 border-white/5 hover:bg-surface-container-high hover:border-white/10 shadow-md'
                }`}
              >
                <div className="w-full flex items-center justify-between">
                  <span className={`text-xl sm:text-2xl transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                    {cfg.emoji}
                  </span>
                  {isActive ? (
                    <span className="px-1.5 sm:px-2 py-0.5 rounded-full bg-tertiary-container text-on-tertiary-container text-[0.6rem] sm:text-[0.65rem] font-bold uppercase tracking-wider">
                      Active
                    </span>
                  ) : (
                    <span className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${cfg.dotColor}`}></span>
                  )}
                </div>

                <div>
                  <h3 className={`font-headline-sm text-xs sm:text-headline-sm font-bold ${isActive ? 'text-tertiary' : 'text-on-surface'}`}>
                    {cfg.title}
                  </h3>
                  <span className="font-label-md text-[10px] sm:text-[0.7rem] text-on-surface-variant font-medium block">
                    {cfg.subtitle}
                  </span>
                </div>

                <div className="hidden sm:block text-[0.7rem] text-on-surface-variant font-label-md leading-tight line-clamp-1">
                  {cfg.symptoms.slice(0, 2).join(', ')}
                </div>
              </button>
            );
          })}
        </div>

        {/* Dynamic Symptom Chips Container */}
        <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-surface-container-lowest/90 border border-white/5 backdrop-blur-md shadow-inner mb-4 relative z-10">
          <div className="flex items-center justify-between mb-2.5 sm:mb-3 flex-wrap gap-2">
            <span className="font-label-md text-xs text-on-surface-variant font-semibold">
              Contextual Symptoms (<span className="text-tertiary font-bold">{FEEL_CONFIGS[selectedFeel].title}</span>)
            </span>
            <span className="text-[10px] sm:text-[0.7rem] text-outline">Tap to toggle</span>
          </div>

          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {FEEL_CONFIGS[selectedFeel].symptoms.map((symptom) => {
              const isSelected = selectedChips.includes(symptom);
              return (
                <button
                  key={symptom}
                  onClick={() => handleToggleChip(symptom)}
                  type="button"
                  className={`px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-tertiary/20 text-tertiary border border-tertiary/40 font-bold shadow-sm'
                      : 'bg-surface-container text-on-surface-variant hover:text-on-surface border border-white/5'
                  }`}
                >
                  {isSelected ? `✓ ${symptom}` : `+ ${symptom}`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Note & Rapid Commit Button Row */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 sm:gap-3 relative z-10">
          <div className="relative flex-1 w-full">
            <span className="material-symbols-outlined absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[1.125rem] sm:text-[1.25rem]">
              edit_note
            </span>
            <input
              type="text"
              value={feelNote}
              onChange={(e) => setFeelNote(e.target.value)}
              placeholder="Quick note (e.g. 2 dosa, mid-exam, evening run...)"
              className="w-full pl-10 sm:pl-12 pr-4 py-2.5 sm:py-3 bg-surface-container border border-white/5 rounded-full text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary font-body-md text-xs sm:text-sm shadow-inner transition-all"
            />
          </div>

          <button
            onClick={handleSaveSensoryFeel}
            type="button"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 sm:px-8 py-2.5 sm:py-3 rounded-full bg-primary-container text-on-primary font-body-md text-xs sm:text-sm font-bold shadow-[0_10px_25px_-5px_rgba(16,185,129,0.4)] hover:bg-primary transition-all active:scale-95 shrink-0"
          >
            <span className="material-symbols-outlined text-[1.125rem] sm:text-[1.25rem]">check</span>
            <span>Save Feel Log</span>
          </button>
        </div>

        {/* Toast confirmation */}
        {feelSavedToast && (
          <div className="mt-3 p-2.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-semibold text-center animate-in fade-in">
            {feelSavedToast}
          </div>
        )}
      </section>

      {/* 4. SPLIT BENTO: QUICK EVENT LAUNCHERS & TODAY'S ACTIVITY STREAM */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        {/* Left Column (4 cols): Fast Add Shortcuts & Origin Blueprint */}
        <div className="lg:col-span-4 flex flex-col gap-3 sm:gap-4">
          <div className="flex items-center justify-between px-1">
            <span className="font-headline-sm text-sm sm:text-headline-sm text-on-surface font-bold">Fast Add</span>
            <span className="font-label-md text-[11px] sm:text-xs text-outline">1-Tap Shortcuts</span>
          </div>

          <div className="grid grid-cols-4 gap-2 sm:grid-cols-2 sm:gap-3">
            {/* + Food */}
            <button
              onClick={() => {
                setEditingFood(null);
                setIsFoodOpen(true);
              }}
              type="button"
              className="p-2 sm:p-4 rounded-xl sm:rounded-2xl bg-surface-container-low/80 hover:bg-surface-container border border-white/5 backdrop-blur-md shadow-lg flex flex-col items-center sm:items-start justify-center sm:justify-between h-20 sm:h-32 text-center sm:text-left group transition-all cursor-pointer active:scale-95"
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-tertiary-container/20 text-tertiary border border-tertiary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-[1.2rem] sm:text-[1.5rem]">restaurant</span>
              </div>
              <div>
                <span className="font-headline-sm text-xs sm:text-sm text-on-surface font-bold block">+ Food</span>
                <span className="text-[0.7rem] text-on-surface-variant font-label-md hidden sm:block">Rice, Dosa, Idly</span>
              </div>
            </button>

            {/* + Activity */}
            <button
              onClick={() => {
                setEditingActivity(null);
                setIsActivityOpen(true);
              }}
              type="button"
              className="p-2 sm:p-4 rounded-xl sm:rounded-2xl bg-surface-container-low/80 hover:bg-surface-container border border-white/5 backdrop-blur-md shadow-lg flex flex-col items-center sm:items-start justify-center sm:justify-between h-20 sm:h-32 text-center sm:text-left group transition-all cursor-pointer active:scale-95"
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-secondary-container/20 text-secondary border border-secondary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-[1.2rem] sm:text-[1.5rem]">directions_run</span>
              </div>
              <div>
                <span className="font-headline-sm text-xs sm:text-sm text-on-surface font-bold block">+ Activity</span>
                <span className="text-[0.7rem] text-on-surface-variant font-label-md hidden sm:block">Run, Walk</span>
              </div>
            </button>

            {/* + Feel Log */}
            <button
              onClick={() => {
                setEditingFeel(null);
                setIsFeelOpen(true);
              }}
              type="button"
              className="p-2 sm:p-4 rounded-xl sm:rounded-2xl bg-surface-container-low/80 hover:bg-surface-container border border-white/5 backdrop-blur-md shadow-lg flex flex-col items-center sm:items-start justify-center sm:justify-between h-20 sm:h-32 text-center sm:text-left group transition-all cursor-pointer active:scale-95"
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/20 text-primary border border-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-[1.2rem] sm:text-[1.5rem]">sentiment_satisfied</span>
              </div>
              <div>
                <span className="font-headline-sm text-xs sm:text-sm text-on-surface font-bold block">+ Feel</span>
                <span className="text-[0.7rem] text-on-surface-variant font-label-md hidden sm:block">Extra slot</span>
              </div>
            </button>

            {/* + Glucose */}
            <button
              onClick={() => {
                setEditingGlucose(null);
                setIsGlucoseOpen(true);
              }}
              type="button"
              className="p-2 sm:p-4 rounded-xl sm:rounded-2xl bg-surface-container-low/80 hover:bg-surface-container border border-white/5 backdrop-blur-md shadow-lg flex flex-col items-center sm:items-start justify-center sm:justify-between h-20 sm:h-32 text-center sm:text-left group transition-all cursor-pointer active:scale-95"
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-secondary/20 text-secondary border border-secondary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-[1.2rem] sm:text-[1.5rem]">water_drop</span>
              </div>
              <div>
                <span className="font-headline-sm text-xs sm:text-sm text-on-surface font-bold block">+ Sugar</span>
                <span className="text-[0.7rem] text-on-surface-variant font-label-md hidden sm:block">mg/dL</span>
              </div>
            </button>
          </div>

          {/* Prototype Origin Blueprint Badge (Desktop only) */}
          <div className="hidden md:flex p-4 rounded-2xl bg-surface-container-lowest/80 border border-white/5 backdrop-blur-md shadow-sm items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary shrink-0 border border-primary/20">
              <span className="material-symbols-outlined text-[1.25rem]">architecture</span>
            </div>
            <div className="min-w-0">
              <span className="font-label-md text-[0.7rem] text-primary uppercase font-bold tracking-wider">
                Source Blueprint
              </span>
              <p className="font-body-md text-sm text-on-surface font-semibold truncate">
                Type 1 Minimal Logbook
              </p>
              <p className="text-[0.7rem] text-on-surface-variant truncate">
                Evolved into calm glass telemetry
              </p>
            </div>
          </div>

          {/* Medical Guardrail Note (Desktop only) */}
          <div className="hidden md:block p-3.5 rounded-2xl bg-surface-container-low/40 border border-white/5 text-[0.72rem] text-on-surface-variant leading-relaxed">
            <span className="text-secondary font-semibold">Diary Note:</span> Feelog does not offer clinical insulin titration or predictive medical advice. All data belongs locally to you and your diabetologist.
          </div>
        </div>

        {/* Right Column (8 cols): Today's Activity & Metabolic Rhythm Stream */}
        <div className="lg:col-span-8 rounded-2xl sm:rounded-3xl bg-surface-container-low/70 backdrop-blur-xl p-4 sm:p-5 md:p-6 border border-white/5 shadow-xl shadow-surface-container-lowest/40 flex flex-col justify-between">
          <div>
            {/* Timeline Header */}
            <div className="flex items-center justify-between pb-3 sm:pb-4 mb-3 sm:mb-4 border-b border-surface-container-high/40">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[1.125rem] sm:text-[1.25rem]">timeline</span>
                <span className="font-headline-sm text-sm sm:text-headline-sm text-on-surface font-bold">
                  <span className="hidden sm:inline">Today&apos;s Timeline Stream</span>
                  <span className="sm:hidden">Today&apos;s Stream</span>
                </span>
                <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[0.65rem] sm:text-[0.7rem] font-semibold border border-white/5">
                  {todayLogs.length}
                </span>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                {todayLogs.length === 0 && (
                  <button
                    onClick={() => {
                      seedRealisticPGData();
                      refreshData();
                    }}
                    type="button"
                    className="text-xs text-primary font-bold hover:underline"
                  >
                    <span className="hidden sm:inline">Load Demo PG Data</span>
                    <span className="sm:hidden">Load Demo</span>
                  </button>
                )}
                <Link
                  href="/timeline"
                  className="font-body-md text-xs text-primary hover:underline flex items-center gap-0.5 sm:gap-1 font-semibold"
                >
                  <span className="hidden sm:inline">Full 24h View</span>
                  <span className="sm:hidden">View All</span>
                  <span className="material-symbols-outlined text-[0.95rem] sm:text-[1rem]">arrow_forward</span>
                </Link>
              </div>
            </div>

            {/* Timeline Items List */}
            {todayLogs.length === 0 ? (
              <div className="py-8 sm:py-12 text-center flex flex-col items-center justify-center">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-surface-container flex items-center justify-center text-outline mb-2 sm:mb-3">
                  <span className="material-symbols-outlined text-[1.25rem] sm:text-[1.5rem]">schedule</span>
                </div>
                <p className="font-headline-sm text-xs sm:text-sm text-on-surface font-bold">
                  No logs recorded for today yet.
                </p>
                <p className="text-[11px] sm:text-xs text-on-surface-variant mt-1 max-w-sm">
                  <span className="hidden sm:inline">Tap any 5-second feel card or Fast Add shortcut above, or load the realistic 14-day Bangalore PG student sample dataset.</span>
                  <span className="sm:hidden">Tap a button above to log or load sample data.</span>
                </p>
                <button
                  onClick={() => {
                    seedRealisticPGData();
                    refreshData();
                  }}
                  className="mt-3 sm:mt-4 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full bg-primary-container text-on-primary text-xs font-bold shadow-md hover:bg-primary transition-all active:scale-95"
                  type="button"
                >
                  Seed Demo Data
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {todayLogs.map((item) => {
                  let iconName = 'schedule';
                  let iconBg = 'bg-surface-container text-on-surface-variant';
                  let title = '';
                  let badge = '';
                  let badgeBg = 'bg-surface-container text-on-surface-variant';
                  let details = '';
                  let rightTag = 'Logged';

                  if (item.category === 'insulin' && item.insulin) {
                    iconName = 'vaccines';
                    const isMorning = item.insulin.insulin_type === 'morning_regular';
                    const isNight = item.insulin.insulin_type === 'night_30_70';
                    const isAfternoon = item.insulin.insulin_type === 'afternoon_regular';

                    iconBg = isMorning
                      ? 'bg-primary/20 text-primary border border-primary/20'
                      : isNight
                      ? 'bg-secondary/20 text-secondary border border-secondary/20'
                      : 'bg-tertiary/20 text-tertiary border border-tertiary/20';

                    title = isMorning
                      ? 'Morning Regular (R) Dose'
                      : isNight
                      ? 'Night 30/70 Biphasic Dose'
                      : isAfternoon
                      ? 'Afternoon Midday Regular Dose'
                      : 'Correction Insulin Dose';

                    badge = `${item.insulin.units} U`;
                    badgeBg = isMorning
                      ? 'bg-primary/15 text-primary border border-primary/20'
                      : isNight
                      ? 'bg-secondary/15 text-secondary border border-secondary/20'
                      : 'bg-tertiary/15 text-tertiary border border-tertiary/20';

                    details = item.insulin.note || 'Subcutaneous injection';
                    rightTag = item.insulin.taken ? 'Taken ✓' : 'Scheduled';
                  } else if (item.category === 'food' && item.food) {
                    iconName = 'restaurant';
                    iconBg = 'bg-tertiary/20 text-tertiary border border-tertiary/20';
                    title = `${item.food.meal.charAt(0).toUpperCase() + item.food.meal.slice(1)} · ${item.food.items}`;
                    badge = `${item.food.carb_size ? item.food.carb_size + ' Carb' : 'Meal'}`;
                    badgeBg = 'bg-tertiary/15 text-tertiary border border-tertiary/20';
                    details = item.food.note || 'Logged meal';
                    rightTag = 'Logged';
                  } else if (item.category === 'activity' && item.activity) {
                    iconName = 'directions_run';
                    iconBg = 'bg-secondary/20 text-secondary border border-secondary/20';
                    title = `${item.activity.activity_type.charAt(0).toUpperCase() + item.activity.activity_type.slice(1)} Workout`;
                    badge = `${item.activity.duration_min} min`;
                    badgeBg = 'bg-secondary/15 text-secondary border border-secondary/20';
                    details = item.activity.note || `Intensity: ${item.activity.intensity || 'moderate'}`;
                    rightTag = 'High Rhythm';
                  } else if (item.category === 'feel' && item.feel) {
                    iconName = 'mood';
                    iconBg = 'bg-tertiary-container/20 text-tertiary border border-tertiary/20';
                    title = `Feel: ${FEEL_CONFIGS[item.feel.feel]?.title || item.feel.feel}`;
                    badge = item.feel.symptoms.slice(0, 2).join(', ') || 'Check-in';
                    badgeBg = 'bg-tertiary-container/15 text-tertiary border border-tertiary/20';
                    details = item.feel.note || `Symptoms: ${item.feel.symptoms.join(', ')}`;
                    rightTag = 'Sensory Log';
                  } else if (item.category === 'glucose' && item.glucose) {
                    iconName = 'water_drop';
                    iconBg = 'bg-secondary-fixed-dim/20 text-secondary-fixed border border-secondary/20';
                    title = `Blood Glucose: ${item.glucose.reading_mgdl} mg/dL`;
                    badge = item.glucose.context || 'Spot Check';
                    badgeBg = 'bg-secondary-fixed-dim/15 text-secondary border border-secondary/20';
                    details = item.glucose.note || 'Meter reading';
                    rightTag = `${item.glucose.reading_mgdl} mg/dL`;
                  }

                  return (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-2xl bg-surface-container/60 hover:bg-surface-container border border-white/5 transition-all flex items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-label-md text-xs text-outline font-mono w-16 shrink-0">
                          {formatISTTime(item.log_time)}
                        </span>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
                          <span className="material-symbols-outlined text-[1.125rem]" style={{ fontVariationSettings: "'FILL' 1" }}>
                            {iconName}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-body-md text-sm text-on-surface font-bold truncate">
                              {title}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[0.65rem] font-semibold ${badgeBg}`}>
                              {badge}
                            </span>
                          </div>
                          <p className="text-xs text-on-surface-variant truncate">
                            {details}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        <span className="hidden sm:inline text-xs font-semibold text-primary">
                          {rightTag}
                        </span>
                        <button
                          onClick={() => handleEditItem(item)}
                          className="opacity-70 sm:opacity-0 sm:group-hover:opacity-100 p-1 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-opacity"
                          title="Edit"
                          type="button"
                        >
                          <span className="material-symbols-outlined text-[1rem]">edit</span>
                        </button>
                        <button
                          onClick={() => setDeleteTarget(item)}
                          className="opacity-70 sm:opacity-0 sm:group-hover:opacity-100 p-1 rounded-lg text-error hover:bg-error-container/20 transition-opacity"
                          title="Delete"
                          type="button"
                        >
                          <span className="material-symbols-outlined text-[1rem]">delete</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Day Rhythm Summary Progress Bar */}
          <div className="pt-5 mt-5 border-t border-surface-container-high/40">
            <div className="flex items-center justify-between text-xs text-on-surface-variant font-label-md mb-2">
              <span>Daily Metabolic Target Progress</span>
              <span className="text-primary font-bold">85% On Track</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-surface-container overflow-hidden flex border border-white/5">
              <div className="h-full bg-primary" style={{ width: '55%' }} title="In-Range / Okay Time"></div>
              <div className="h-full bg-tertiary" style={{ width: '30%' }} title="Slightly High Segment"></div>
              <div className="h-full bg-secondary" style={{ width: '15%' }} title="Post-Exercise Period"></div>
            </div>
            <div className="flex items-center justify-between text-[0.68rem] text-outline mt-1.5 font-label-md">
              <span>Morning: Fasting Balanced</span>
              <span>Afternoon: Midday Response</span>
              <span>Evening: Basal Prep at 8:30 PM</span>
            </div>
          </div>
        </div>
      </section>

      {/* Modal Sheets & Confirmation Dialogs */}
      <FoodSheet
        isOpen={isFoodOpen}
        onClose={() => {
          setIsFoodOpen(false);
          setEditingFood(null);
        }}
        onSaved={refreshData}
        dateStr={todayStr}
        initialData={editingFood}
      />
      <ActivitySheet
        isOpen={isActivityOpen}
        onClose={() => {
          setIsActivityOpen(false);
          setEditingActivity(null);
        }}
        onSaved={refreshData}
        dateStr={todayStr}
        initialData={editingActivity}
      />
      <FeelSheet
        isOpen={isFeelOpen}
        onClose={() => {
          setIsFeelOpen(false);
          setEditingFeel(null);
        }}
        onSaved={refreshData}
        dateStr={todayStr}
        initialData={editingFeel}
      />
      <GlucoseSheet
        isOpen={isGlucoseOpen}
        onClose={() => {
          setIsGlucoseOpen(false);
          setEditingGlucose(null);
        }}
        onSaved={refreshData}
        dateStr={todayStr}
        initialData={editingGlucose}
      />
      <InsulinSheet
        isOpen={isInsulinOpen}
        onClose={() => {
          setIsInsulinOpen(false);
          setEditingInsulin(null);
        }}
        onSaved={refreshData}
        dateStr={todayStr}
        type={insulinModalType}
        initialData={editingInsulin}
      />
      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        title="Delete Log Entry"
        message="Are you sure you want to remove this logged entry from your diary?"
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
