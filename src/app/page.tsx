'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Flame,
  Utensils,
  Activity as ActivityIcon,
  HeartPulse,
  Droplets,
  Syringe,
  CheckCircle2,
  Clock,
  X,
  Edit2,
  Trash2,
} from 'lucide-react';
import {
  getTodayIST,
  formatISTDate,
  formatISTTime,
  calculateStreak,
} from '@/lib/date-utils';
import {
  getUnifiedLogsForDate,
  getInsulinLogs,
  getGlucoseLogs,
  getAllLoggedDates,
  getSettings,
  saveInsulinLog,
  deleteInsulinLog,
  deleteFoodLog,
  deleteActivityLog,
  deleteFeelLog,
  deleteGlucoseLog,
  isGlucosePromptDismissedToday,
  dismissGlucosePromptToday,
  seedRealisticPGData,
} from '@/lib/sync-storage';
import {
  UnifiedLogItem,
  UserSettings,
  InsulinLog,
  FoodLog,
  ActivityLog,
  FeelLog,
  GlucoseLog,
  FEEL_COLORS,
} from '@/types';
import FoodSheet from '@/components/FoodSheet';
import ActivitySheet from '@/components/ActivitySheet';
import FeelSheet from '@/components/FeelSheet';
import GlucoseSheet from '@/components/GlucoseSheet';
import InsulinSheet from '@/components/InsulinSheet';
import DeleteConfirmModal from '@/components/DeleteConfirmModal';

export default function QuickLogPage() {
  const [todayStr] = useState<string>(getTodayIST());
  const [todayLogs, setTodayLogs] = useState<UnifiedLogItem[]>([]);
  const [streak, setStreak] = useState<number>(0);
  const [settings, setSettings] = useState<UserSettings>(getSettings());
  const [showGlucosePrompt, setShowGlucosePrompt] = useState<boolean>(false);

  // Modal states
  const [isFoodOpen, setIsFoodOpen] = useState(false);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [isFeelOpen, setIsFeelOpen] = useState(false);
  const [isGlucoseOpen, setIsGlucoseOpen] = useState(false);
  const [isInsulinOpen, setIsInsulinOpen] = useState(false);
  const [insulinModalType, setInsulinModalType] = useState<'morning_regular' | 'night_30_70'>('morning_regular');

  // Editing state
  const [editingFood, setEditingFood] = useState<FoodLog | null>(null);
  const [editingActivity, setEditingActivity] = useState<ActivityLog | null>(null);
  const [editingFeel, setEditingFeel] = useState<FeelLog | null>(null);
  const [editingGlucose, setEditingGlucose] = useState<GlucoseLog | null>(null);
  const [editingInsulin, setEditingInsulin] = useState<InsulinLog | null>(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<UnifiedLogItem | null>(null);

  const refreshData = useCallback(() => {
    const logs = getUnifiedLogsForDate(todayStr);
    setTodayLogs(logs);

    const allDates = getAllLoggedDates();
    setStreak(calculateStreak(allDates));

    const currentSettings = getSettings();
    setSettings(currentSettings);

    // Glucose Prompt Card logic:
    // If no glucose_logs row for today AND not dismissed today
    const dayGlucoseLogs = getGlucoseLogs().filter((g) => g.log_date === todayStr);
    const dismissed = isGlucosePromptDismissedToday();
    setShowGlucosePrompt(dayGlucoseLogs.length === 0 && !dismissed);
  }, [todayStr]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Check today's insulin status
  const todayInsulinLogs = getInsulinLogs().filter((l) => l.log_date === todayStr);
  const morningLog = todayInsulinLogs.find((l) => l.insulin_type === 'morning_regular');
  const nightLog = todayInsulinLogs.find((l) => l.insulin_type === 'night_30_70');

  const handleQuickTakeInsulin = (type: 'morning_regular' | 'night_30_70', units: number) => {
    const defaultTime = type === 'morning_regular' ? '08:00' : '20:30';
    saveInsulinLog({
      user_id: 'user-1',
      log_date: todayStr,
      log_time: defaultTime,
      insulin_type: type,
      units,
      taken: true,
      note: 'Quick logged via pre-filled card',
    });
    refreshData();
  };

  const handleDismissGlucosePrompt = () => {
    dismissGlucosePromptToday();
    setShowGlucosePrompt(false);
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

  return (
    <div className="pb-28 max-w-lg mx-auto px-4 pt-4">
      {/* Top Header: Today's date in IST & Streak Counter */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wider">
            <span>Today (IST)</span>
            <span>•</span>
            <span>Bangalore PG</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
            {formatISTDate(todayStr, { weekday: 'long', month: 'short', day: 'numeric' })}
          </h1>
        </div>

        {/* Streak Counter */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 dark:bg-orange-950/40 border border-orange-200/80 dark:border-orange-800/50 shadow-sm">
          <Flame className="w-4 h-4 text-orange-500 fill-orange-500 animate-pulse" />
          <span className="text-xs font-bold text-orange-700 dark:text-orange-300">
            {streak > 0 ? `${streak} day${streak > 1 ? 's' : ''} in a row` : 'Start streak'}
          </span>
        </div>
      </div>

      {/* Conditional Glucose Prompt Card (At most once per day) */}
      {showGlucosePrompt && (
        <div className="mb-4 p-3.5 bg-gradient-to-r from-rose-50/90 to-pink-50/90 dark:from-rose-950/30 dark:to-pink-950/30 border border-rose-200/70 dark:border-rose-900/50 rounded-2xl flex items-center justify-between gap-3 shadow-sm animate-in fade-in duration-300">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-300 flex items-center justify-center shrink-0">
              <Droplets className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Got a reading today?
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Optional: Add your fingerstick or lab number.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setEditingGlucose(null);
                setIsGlucoseOpen(true);
              }}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm active:scale-95 transition-all"
            >
              Add it
            </button>
            <button
              type="button"
              onClick={handleDismissGlucosePrompt}
              aria-label="Dismiss"
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-rose-100/50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Pre-filled Insulin Card */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-4 shadow-sm mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <Syringe className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Daily Insulin Regimen
            </span>
          </div>
          <span className="text-[10px] text-slate-400">Fixed doses</span>
        </div>

        <div className="space-y-2.5">
          {/* Row 1: Morning Regular */}
          <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-750/50 rounded-xl border border-slate-100 dark:border-slate-700/50">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Morning · Regular (R)
                </span>
                <span className="text-xs font-black text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/50 px-2 py-0.5 rounded-full border border-teal-200/50">
                  {morningLog ? morningLog.units : settings.morning_regular_units} U
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {morningLog
                  ? `Logged at ${formatISTTime(morningLog.log_time)} ✓`
                  : 'Before morning PG breakfast'}
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              {morningLog ? (
                <button
                  type="button"
                  onClick={() => {
                    setInsulinModalType('morning_regular');
                    setEditingInsulin(morningLog);
                    setIsInsulinOpen(true);
                  }}
                  className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg flex items-center gap-1"
                >
                  <Edit2 className="w-3 h-3" />
                  Edit
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      handleQuickTakeInsulin('morning_regular', settings.morning_regular_units)
                    }
                    className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-sm active:scale-95 transition-all flex items-center gap-1 min-h-[44px]"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Taken ✓
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInsulinModalType('morning_regular');
                      setEditingInsulin(null);
                      setIsInsulinOpen(true);
                    }}
                    className="px-2 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 rounded-lg min-h-[44px]"
                  >
                    Edit
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Row 2: Night 30/70 */}
          <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-750/50 rounded-xl border border-slate-100 dark:border-slate-700/50">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Night · 30/70 Biphasic
                </span>
                <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-full border border-indigo-200/50">
                  {nightLog ? nightLog.units : settings.night_30_70_units} U
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {nightLog
                  ? `Logged at ${formatISTTime(nightLog.log_time)} ✓`
                  : 'Before PG dinner'}
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              {nightLog ? (
                <button
                  type="button"
                  onClick={() => {
                    setInsulinModalType('night_30_70');
                    setEditingInsulin(nightLog);
                    setIsInsulinOpen(true);
                  }}
                  className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg flex items-center gap-1"
                >
                  <Edit2 className="w-3 h-3" />
                  Edit
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      handleQuickTakeInsulin('night_30_70', settings.night_30_70_units)
                    }
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm active:scale-95 transition-all flex items-center gap-1 min-h-[44px]"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Taken ✓
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInsulinModalType('night_30_70');
                      setEditingInsulin(null);
                      setIsInsulinOpen(true);
                    }}
                    className="px-2 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 rounded-lg min-h-[44px]"
                  >
                    Edit
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Four Big Action Buttons */}
      <div className="mb-6">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
          Log an Event
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {/* + Food */}
          <button
            type="button"
            onClick={() => {
              setEditingFood(null);
              setIsFoodOpen(true);
            }}
            className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-gradient-to-b from-amber-50 to-orange-50/60 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-200/80 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 shadow-sm hover:shadow-md transition-all active:scale-[0.98] min-h-[72px]"
          >
            <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center mb-1.5 shadow-sm">
              <Utensils className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold">+ Food</span>
            <span className="text-[10px] text-amber-700/80 dark:text-amber-400/80">Meals & Carbs</span>
          </button>

          {/* + Activity */}
          <button
            type="button"
            onClick={() => {
              setEditingActivity(null);
              setIsActivityOpen(true);
            }}
            className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-gradient-to-b from-blue-50 to-sky-50/60 dark:from-blue-950/30 dark:to-sky-950/20 border border-blue-200/80 dark:border-blue-800/60 text-blue-900 dark:text-blue-200 shadow-sm hover:shadow-md transition-all active:scale-[0.98] min-h-[72px]"
          >
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center mb-1.5 shadow-sm">
              <ActivityIcon className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold">+ Activity</span>
            <span className="text-[10px] text-blue-700/80 dark:text-blue-400/80">Run / Workout</span>
          </button>

          {/* + Feel */}
          <button
            type="button"
            onClick={() => {
              setEditingFeel(null);
              setIsFeelOpen(true);
            }}
            className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-gradient-to-b from-purple-50 to-violet-50/60 dark:from-purple-950/30 dark:to-violet-950/20 border border-purple-200/80 dark:border-purple-800/60 text-purple-900 dark:text-purple-200 shadow-sm hover:shadow-md transition-all active:scale-[0.98] min-h-[72px]"
          >
            <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center mb-1.5 shadow-sm">
              <HeartPulse className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold">+ Feel</span>
            <span className="text-[10px] text-purple-700/80 dark:text-purple-400/80">Low/High Symptoms</span>
          </button>

          {/* + Glucose */}
          <button
            type="button"
            onClick={() => {
              setEditingGlucose(null);
              setIsGlucoseOpen(true);
            }}
            className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-gradient-to-b from-rose-50 to-red-50/60 dark:from-rose-950/30 dark:to-red-950/20 border border-rose-200/80 dark:border-rose-800/60 text-rose-900 dark:text-rose-200 shadow-sm hover:shadow-md transition-all active:scale-[0.98] min-h-[72px]"
          >
            <div className="w-8 h-8 rounded-full bg-rose-600 text-white flex items-center justify-center mb-1.5 shadow-sm">
              <Droplets className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold">+ Glucose</span>
            <span className="text-[10px] text-rose-700/80 dark:text-rose-400/80">Meter mg/dL</span>
          </button>
        </div>
      </div>

      {/* Today's Entries Feed (Merged Chronological) */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-slate-500" />
            Today&apos;s Logs ({todayLogs.length})
          </h2>
          {todayLogs.length === 0 && (
            <button
              type="button"
              onClick={() => {
                seedRealisticPGData();
                refreshData();
              }}
              className="text-[11px] text-teal-600 dark:text-teal-400 font-bold hover:underline"
            >
              Load Demo PG Data
            </button>
          )}
        </div>

        {todayLogs.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-slate-800/60 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
              No entries logged for today yet.
            </p>
            <p className="text-[11px] text-slate-400">
              Tap any action button above to log food, activity, or how you feel.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {todayLogs.map((item) => {
              let icon = <Clock className="w-4 h-4" />;
              let iconBg = 'bg-slate-100 text-slate-600';
              let title = '';
              let subtitle = '';
              let badge = null;

              if (item.category === 'insulin' && item.insulin) {
                icon = <Syringe className="w-4 h-4" />;
                iconBg = 'bg-teal-100 dark:bg-teal-950/60 text-teal-600';
                title = `${item.insulin.insulin_type === 'morning_regular' ? 'Morning Regular' : 'Night 30/70'} · ${item.insulin.units} U`;
                subtitle = item.insulin.note || (item.insulin.taken ? 'Taken as prescribed' : 'Skipped');
              } else if (item.category === 'food' && item.food) {
                icon = <Utensils className="w-4 h-4" />;
                iconBg = 'bg-amber-100 dark:bg-amber-950/60 text-amber-600';
                title = `${item.food.meal.charAt(0).toUpperCase() + item.food.meal.slice(1)}: ${item.food.items}`;
                subtitle = item.food.note || `Carb portion: ${item.food.carb_size || 'standard'}`;
                if (item.food.carb_size) {
                  badge = (
                    <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                      {item.food.carb_size} carb
                    </span>
                  );
                }
              } else if (item.category === 'activity' && item.activity) {
                icon = <ActivityIcon className="w-4 h-4" />;
                iconBg = 'bg-blue-100 dark:bg-blue-950/60 text-blue-600';
                title = `${item.activity.activity_type.charAt(0).toUpperCase() + item.activity.activity_type.slice(1)} · ${item.activity.duration_min} min`;
                subtitle = item.activity.note || `Intensity: ${item.activity.intensity || 'moderate'}`;
              } else if (item.category === 'feel' && item.feel) {
                const feelCfg = FEEL_COLORS[item.feel.feel];
                icon = <HeartPulse className="w-4 h-4" />;
                iconBg = `${feelCfg.bg} text-white`;
                title = `Felt ${feelCfg.label}`;
                subtitle =
                  item.feel.symptoms && item.feel.symptoms.length > 0
                    ? `Symptoms: ${item.feel.symptoms.join(', ')}`
                    : item.feel.note || 'No specific symptoms noted';
                badge = (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${feelCfg.badge}`}>
                    {feelCfg.label}
                  </span>
                );
              } else if (item.category === 'glucose' && item.glucose) {
                icon = <Droplets className="w-4 h-4" />;
                iconBg = 'bg-rose-100 dark:bg-rose-950/60 text-rose-600';
                title = `${item.glucose.reading_mgdl} mg/dL`;
                subtitle = item.glucose.note || `Context: ${item.glucose.context || 'general'}`;
                badge = (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                    Meter Reading
                  </span>
                );
              }

              return (
                <div
                  key={item.id}
                  className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/70 shadow-sm flex items-center justify-between gap-3 hover:border-slate-300 transition-colors"
                >
                  <div
                    onClick={() => handleEditItem(item)}
                    className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
                      {icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-bold text-slate-400">
                          {formatISTTime(item.log_time)}
                        </span>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                          {title}
                        </span>
                        {badge}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleEditItem(item)}
                      aria-label="Edit"
                      className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(item)}
                      aria-label="Delete"
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sheets & Modals */}
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
        insulinType={insulinModalType}
        defaultUnits={
          insulinModalType === 'morning_regular'
            ? settings.morning_regular_units
            : settings.night_30_70_units
        }
        initialData={editingInsulin}
      />

      <DeleteConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirmed}
        title="Delete Log Entry"
        message="Are you sure you want to delete this log entry? This cannot be undone."
      />
    </div>
  );
}
