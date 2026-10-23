'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  getTodayIST,
  formatISTDate,
  formatISTTime,
  shiftDate,
} from '@/lib/date-utils';
import {
  getUnifiedLogsForDate,
  deleteInsulinLog,
  deleteFoodLog,
  deleteActivityLog,
  deleteFeelLog,
  deleteGlucoseLog,
} from '@/lib/sync-storage';
import {
  UnifiedLogItem,
  FoodLog,
  ActivityLog,
  FeelLog,
  GlucoseLog,
  InsulinLog,
  InsulinType,
  FEEL_COLORS,
} from '@/types';
import FoodSheet from '@/components/FoodSheet';
import ActivitySheet from '@/components/ActivitySheet';
import FeelSheet from '@/components/FeelSheet';
import GlucoseSheet from '@/components/GlucoseSheet';
import InsulinSheet from '@/components/InsulinSheet';
import DeleteConfirmModal from '@/components/DeleteConfirmModal';

type FilterType = 'all' | 'insulin' | 'feelings' | 'food' | 'activity';

export default function TimelinePage() {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayIST());
  const [logs, setLogs] = useState<UnifiedLogItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  // Sheet states
  const [isFoodOpen, setIsFoodOpen] = useState(false);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [isFeelOpen, setIsFeelOpen] = useState(false);
  const [isGlucoseOpen, setIsGlucoseOpen] = useState(false);
  const [isInsulinOpen, setIsInsulinOpen] = useState(false);
  const [insulinModalType, setInsulinModalType] = useState<InsulinType>('morning_regular');

  const [editingFood, setEditingFood] = useState<FoodLog | null>(null);
  const [editingActivity, setEditingActivity] = useState<ActivityLog | null>(null);
  const [editingFeel, setEditingFeel] = useState<FeelLog | null>(null);
  const [editingGlucose, setEditingGlucose] = useState<GlucoseLog | null>(null);
  const [editingInsulin, setEditingInsulin] = useState<InsulinLog | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<UnifiedLogItem | null>(null);

  const refreshLogs = useCallback(() => {
    const dayLogs = getUnifiedLogsForDate(selectedDate);
    setLogs(dayLogs);
  }, [selectedDate]);

  useEffect(() => {
    refreshLogs();
  }, [refreshLogs]);

  const handlePrevDay = () => setSelectedDate((d) => shiftDate(d, -1));
  const handleNextDay = () => setSelectedDate((d) => shiftDate(d, 1));
  const isToday = selectedDate === getTodayIST();

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
    refreshLogs();
  };

  // Filter logs
  const filteredLogs = logs.filter((item) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'insulin') return item.category === 'insulin';
    if (activeFilter === 'feelings') return item.category === 'feel';
    if (activeFilter === 'food') return item.category === 'food';
    if (activeFilter === 'activity') return item.category === 'activity';
    return true;
  });

  // Derived metrics
  const insulinLogs = logs.filter((l) => l.category === 'insulin' && l.insulin);
  const totalInsulinUnits = insulinLogs.reduce((sum, l) => sum + (l.insulin?.units || 0), 0);
  const afternoonDose = insulinLogs.find((l) => l.insulin?.insulin_type === 'afternoon_regular');
  const morningDose = insulinLogs.find((l) => l.insulin?.insulin_type === 'morning_regular');
  const nightDose = insulinLogs.find((l) => l.insulin?.insulin_type === 'night_30_70');
  const correctionDoses = insulinLogs.filter((l) => l.insulin?.insulin_type === 'correction' || l.insulin?.insulin_type === 'other');

  const feelItems = logs.filter((l) => l.category === 'feel' && l.feel);
  const highFeelItem = feelItems.find((l) => l.feel?.feel === 'high' || l.feel?.feel === 'slightly_high');

  const activityItems = logs.filter((l) => l.category === 'activity' && l.activity);
  const totalActivityMin = activityItems.reduce((acc, a) => acc + (a.activity?.duration_min || 0), 0);

  const glucoseItems = logs.filter((l) => l.category === 'glucose' && l.glucose);
  const latestGlucose = glucoseItems[glucoseItems.length - 1]?.glucose?.reading_mgdl;

  return (
    <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-6">
      {/* SUB-HEADER / DATE CONTROL STRIP */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
        {/* Day Switcher */}
        <div className="flex items-center gap-2 bg-surface-container-low/90 backdrop-blur-xl p-1.5 rounded-full border border-white/5 shadow-lg self-start md:self-auto">
          <button
            onClick={handlePrevDay}
            className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all active:scale-95"
            type="button"
            title="Previous Day"
          >
            <span className="material-symbols-outlined text-[1.25rem]">chevron_left</span>
          </button>

          <div className="px-4 py-1 flex items-center gap-2 text-center">
            <span className="material-symbols-outlined text-primary text-[1.125rem]">calendar_today</span>
            <span className="font-headline-sm text-sm sm:text-base text-on-surface tracking-tight font-bold">
              {formatISTDate(selectedDate, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            {isToday && (
              <span className="px-2 py-0.5 rounded-full bg-primary-container/20 text-primary font-label-md text-xs font-bold border border-primary/20">
                Today
              </span>
            )}
          </div>

          <button
            onClick={handleNextDay}
            className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all active:scale-95"
            type="button"
            title="Next Day"
          >
            <span className="material-symbols-outlined text-[1.25rem]">chevron_right</span>
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(
            [
              { key: 'all', label: `All Events (${logs.length})` },
              { key: 'insulin', label: `Insulin (${insulinLogs.length})` },
              { key: 'feelings', label: `Feelings (${feelItems.length})` },
              { key: 'food', label: `Food (${logs.filter((l) => l.category === 'food').length})` },
              { key: 'activity', label: `Workouts (${activityItems.length})` },
            ] as { key: FilterType; label: string }[]
          ).map((filter) => (
            <button
              key={filter.key}
              onClick={() => setActiveFilter(filter.key)}
              type="button"
              className={`px-3.5 py-1.5 rounded-full font-label-md text-xs font-semibold transition-all ${
                activeFilter === filter.key
                  ? 'bg-surface-container-high text-primary shadow-inner border border-primary/30'
                  : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container border border-white/5'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* DAILY SUMMARY METRIC CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {/* Daily Insulin */}
        <div className="p-4 rounded-2xl bg-surface-container-low/70 backdrop-blur-xl border border-white/5 shadow-lg relative overflow-hidden group hover:bg-surface-container-low transition-all">
          <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full bg-primary/10 blur-xl pointer-events-none"></div>
          <div className="flex items-center justify-between pb-1">
            <span className="font-label-md text-xs text-on-surface-variant uppercase tracking-wider">Daily Insulin</span>
            <span className="material-symbols-outlined text-primary text-[1.125rem]">vaccines</span>
          </div>
          <div className="font-label-numeric text-2xl text-on-surface font-bold">
            {totalInsulinUnits}
            <span className="text-sm font-normal text-on-surface-variant ml-1">Units</span>
          </div>
          <div className="font-label-md text-xs text-primary mt-1 truncate">
            {insulinLogs.length === 0
              ? 'No doses logged'
              : [
                  morningDose ? `${morningDose.insulin?.units}U Morning` : null,
                  afternoonDose ? `${afternoonDose.insulin?.units}U Midday` : null,
                  nightDose ? `${nightDose.insulin?.units}U Night` : null,
                  correctionDoses.length > 0 ? `${correctionDoses.reduce((s, c) => s + (c.insulin?.units || 0), 0)}U Corr` : null,
                ].filter(Boolean).join(' · ')}
          </div>
        </div>

        {/* Symptoms */}
        <div className="p-4 rounded-2xl bg-surface-container-low/70 backdrop-blur-xl border border-white/5 shadow-lg relative overflow-hidden group hover:bg-surface-container-low transition-all">
          <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full bg-tertiary/10 blur-xl pointer-events-none"></div>
          <div className="flex items-center justify-between pb-1">
            <span className="font-label-md text-xs text-on-surface-variant uppercase tracking-wider">Feel &amp; Symptoms</span>
            <span className="material-symbols-outlined text-tertiary text-[1.125rem]">psychology_alt</span>
          </div>
          <div className="font-label-numeric text-2xl text-tertiary font-bold">
            {feelItems.length}
            <span className="text-sm font-normal text-on-surface-variant ml-1">logged</span>
          </div>
          <div className="font-label-md text-xs text-tertiary mt-1 truncate">
            {feelItems.length === 0
              ? 'No feel entries today'
              : highFeelItem
              ? `Peak ${formatISTTime(highFeelItem.log_time)} (${highFeelItem.feel?.symptoms[0] || highFeelItem.feel?.feel})`
              : `Latest ${formatISTTime(feelItems[feelItems.length - 1].log_time)} (${feelItems[feelItems.length - 1].feel?.feel})`}
          </div>
        </div>

        {/* Physical Load */}
        <div className="p-4 rounded-2xl bg-surface-container-low/70 backdrop-blur-xl border border-white/5 shadow-lg relative overflow-hidden group hover:bg-surface-container-low transition-all">
          <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full bg-secondary/10 blur-xl pointer-events-none"></div>
          <div className="flex items-center justify-between pb-1">
            <span className="font-label-md text-xs text-on-surface-variant uppercase tracking-wider">Physical Load</span>
            <span className="material-symbols-outlined text-secondary text-[1.125rem]">directions_run</span>
          </div>
          <div className="font-label-numeric text-2xl text-secondary font-bold">
            {totalActivityMin}
            <span className="text-sm font-normal text-on-surface-variant ml-1">min</span>
          </div>
          <div className="font-label-md text-xs text-secondary mt-1 truncate">
            {activityItems.length === 0
              ? 'No activity logged'
              : activityItems.map((a) => `${a.activity?.duration_min}m ${a.activity?.activity_type}`).join(' · ')}
          </div>
        </div>

        {/* Optional Spot Glucose */}
        <div className="p-4 rounded-2xl bg-surface-container-low/70 backdrop-blur-xl border border-white/5 shadow-lg relative overflow-hidden group hover:bg-surface-container-low transition-all">
          <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full bg-tertiary-container/10 blur-xl pointer-events-none"></div>
          <div className="flex items-center justify-between pb-1">
            <span className="font-label-md text-xs text-on-surface-variant uppercase tracking-wider">Spot Glucose</span>
            <span className="material-symbols-outlined text-tertiary text-[1.125rem]">bloodtype</span>
          </div>
          <div className="font-label-numeric text-2xl text-tertiary font-bold">
            {latestGlucose ? latestGlucose : '—'}
            {latestGlucose && <span className="text-sm font-normal text-on-surface-variant ml-1">mg/dL</span>}
          </div>
          <div className="font-label-md text-xs text-on-surface-variant mt-1 truncate">
            {glucoseItems.length === 0
              ? 'Optional (0 meter checks)'
              : `${glucoseItems.length} check${glucoseItems.length > 1 ? 's' : ''} (latest ${formatISTTime(glucoseItems[glucoseItems.length - 1].log_time)})`}
          </div>
        </div>
      </div>

      {/* MAIN 2-COLUMN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT: VERTICAL ILLUMINATED BIOMETRIC TIMELINE (Col 8) */}
        <div className="lg:col-span-8 relative">
          {/* Continuous vertical illuminated fiber optic neon trace */}
          <div className="absolute left-6 md:left-8 top-6 bottom-6 w-0.5 bg-gradient-to-b from-secondary via-primary via-tertiary to-primary-container shadow-[0_0_12px_rgba(78,222,163,0.35)] opacity-40 pointer-events-none"></div>

          {/* TIMELINE ENTRIES */}
          <div className="space-y-6 relative">
            {filteredLogs.length === 0 ? (
              <div className="p-8 rounded-2xl bg-surface-container-low/70 border border-white/5 text-center">
                <p className="text-on-surface font-semibold text-sm">No events found for this filter.</p>
                <p className="text-on-surface-variant text-xs mt-1">Switch filter to &quot;All Events&quot; or log a new event.</p>
              </div>
            ) : (
              filteredLogs.map((item) => {
                const isActivity = item.category === 'activity';
                const isInsulin = item.category === 'insulin';
                const isFood = item.category === 'food';
                const isFeel = item.category === 'feel';
                const isGlucose = item.category === 'glucose';

                let nodeColor = 'bg-primary';
                let nodeRing = 'shadow-[0_0_18px_rgba(78,222,163,0.6)]';
                let icon = 'schedule';
                let badgeClass = 'bg-primary-container/20 text-primary border border-primary/20';

                if (isActivity) {
                  nodeColor = 'bg-secondary';
                  nodeRing = 'shadow-[0_0_18px_rgba(76,215,246,0.6)]';
                  icon = 'directions_run';
                  badgeClass = 'bg-secondary-container/20 text-secondary border border-secondary/20';
                } else if (isInsulin) {
                  nodeColor = 'bg-primary';
                  nodeRing = 'shadow-[0_0_18px_rgba(78,222,163,0.6)]';
                  icon = 'vaccines';
                  badgeClass = 'bg-primary-container/20 text-primary border border-primary/20';
                } else if (isFood) {
                  nodeColor = 'bg-tertiary';
                  nodeRing = 'shadow-[0_0_18px_rgba(255,185,95,0.5)]';
                  icon = 'restaurant';
                  badgeClass = 'bg-tertiary-container/20 text-tertiary border border-tertiary/20';
                } else if (isFeel) {
                  const isHigh = item.feel?.feel === 'high' || item.feel?.feel === 'slightly_high';
                  nodeColor = isHigh ? 'bg-tertiary animate-pulse' : 'bg-primary';
                  nodeRing = isHigh ? 'shadow-[0_0_24px_rgba(255,185,95,0.9)]' : 'shadow-[0_0_20px_rgba(78,222,163,0.7)]';
                  icon = isHigh ? 'warning_amber' : 'sentiment_satisfied';
                  badgeClass = isHigh ? 'bg-tertiary-container/30 text-tertiary border border-tertiary/20' : 'bg-primary/20 text-primary border border-primary/20';
                } else if (isGlucose) {
                  nodeColor = 'bg-secondary';
                  nodeRing = 'shadow-[0_0_20px_rgba(76,215,246,0.8)]';
                  icon = 'water_drop';
                  badgeClass = 'bg-secondary-container/20 text-secondary border border-secondary/20';
                }

                return (
                  <div key={item.id} className="relative pl-14 md:pl-20 group transition-all duration-300">
                    {/* Illuminated Node */}
                    <div className={`absolute left-3 md:left-5 top-4 w-6 h-6 rounded-full bg-surface-container-lowest border border-white/10 flex items-center justify-center ring-4 ring-background ${nodeRing}`}>
                      <span className={`material-symbols-outlined text-[11px] ${nodeColor.replace('bg-', 'text-')}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                        {icon}
                      </span>
                    </div>

                    {/* Card Content */}
                    <div className="bg-surface-container-low/80 backdrop-blur-2xl p-5 md:p-6 rounded-3xl border border-white/5 shadow-xl transition-all duration-300 hover:bg-surface-container hover:shadow-[0_12px_30px_rgba(0,0,0,0.45)]">
                      {/* Top Row: Timestamp, Category, Title */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-full font-label-md text-xs font-semibold tracking-wider uppercase ${badgeClass}`}>
                            {formatISTTime(item.log_time)} · {item.category}
                          </span>
                          <span className="font-headline-sm text-sm sm:text-base text-on-surface font-bold">
                            {isActivity && (item.activity?.activity_type === 'run' ? 'Morning Run & Calisthenics' : `${item.activity?.activity_type} Workout`)}
                            {isInsulin && (
                              item.insulin?.insulin_type === 'morning_regular'
                                ? 'Morning Regular Bolus'
                                : item.insulin?.insulin_type === 'afternoon_regular'
                                ? 'Midday Regular Bolus'
                                : item.insulin?.insulin_type === 'night_30_70'
                                ? 'Night Biphasic Injection'
                                : 'Correction / As-Needed Dose'
                            )}
                            {isFood && (item.food?.meal === 'breakfast' ? 'PG Mess Breakfast' : item.food?.meal === 'lunch' ? 'PG Mess Thali Lunch' : `${item.food?.meal} meal`)}
                            {isFeel && (item.feel?.feel === 'slightly_high' ? 'Slightly High (Symptom Peak)' : `Mindful State: ${FEEL_COLORS[item.feel!.feel].label}`)}
                            {isGlucose && 'Optional Meter Reading'}
                          </span>
                        </div>

                        {/* Top Right Tag & Action buttons */}
                        <div className="flex items-center gap-2">
                          {isInsulin && (
                            <span className="px-2.5 py-0.5 rounded-full bg-primary-container/20 text-primary font-label-md text-xs font-semibold flex items-center gap-1 border border-primary/20">
                              <span className="material-symbols-outlined text-[0.875rem]">done_all</span> Administered
                            </span>
                          )}
                          {isFood && item.food?.carb_size && (
                            <span className="px-2.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary font-label-md text-xs font-medium border border-tertiary/20">
                              {item.food.carb_size === 'large' ? 'High Carb' : `${item.food.carb_size} Carb`}
                            </span>
                          )}
                          <button
                            onClick={() => handleEditItem(item)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-on-surface-variant hover:text-on-surface transition-opacity"
                            title="Edit"
                            type="button"
                          >
                            <span className="material-symbols-outlined text-[1rem]">edit</span>
                          </button>
                          <button
                            onClick={() => setDeleteTarget(item)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-error hover:text-error transition-opacity"
                            title="Delete"
                            type="button"
                          >
                            <span className="material-symbols-outlined text-[1rem]">delete</span>
                          </button>
                        </div>
                      </div>

                      {/* Body Description */}
                      {isActivity && item.activity && (
                        <div>
                          <p className="font-body-md text-sm text-on-surface-variant pb-3">
                            {item.activity.note || 'High energy, crisp Bangalore air. 10-minute dynamic calisthenics stretch followed by distance pace.'}
                          </p>
                          <div className="grid grid-cols-3 gap-2 pt-1 pb-2">
                            <div className="bg-surface-container-lowest/60 border border-white/5 rounded-xl p-2.5 text-center">
                              <div className="font-label-md text-[0.65rem] text-on-surface-variant uppercase">Duration</div>
                              <div className="font-headline-sm text-sm text-secondary font-bold">{item.activity.duration_min} min</div>
                            </div>
                            <div className="bg-surface-container-lowest/60 border border-white/5 rounded-xl p-2.5 text-center">
                              <div className="font-label-md text-[0.65rem] text-on-surface-variant uppercase">Type</div>
                              <div className="font-headline-sm text-sm text-on-surface font-bold capitalize">{item.activity.activity_type}</div>
                            </div>
                            <div className="bg-surface-container-lowest/60 border border-white/5 rounded-xl p-2.5 text-center">
                              <div className="font-label-md text-[0.65rem] text-on-surface-variant uppercase">Intensity</div>
                              <div className="font-headline-sm text-sm text-on-surface font-bold capitalize">{item.activity.intensity || 'moderate'}</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {isInsulin && item.insulin && (
                        <div className="flex items-center gap-4 mt-2 p-3 bg-surface-container-lowest/60 border border-white/5 rounded-2xl">
                          <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 flex flex-col items-center justify-center text-primary shrink-0">
                            <span className="font-headline-xl text-xl leading-none font-bold">{item.insulin.units}</span>
                            <span className="font-label-md text-[0.6rem] uppercase font-semibold">Units</span>
                          </div>
                          <div className="flex-1">
                            <div className="font-headline-sm text-sm text-on-surface font-bold">
                              {item.insulin.insulin_type === 'morning_regular'
                                ? 'Regular (R) Insulin (Morning)'
                                : item.insulin.insulin_type === 'afternoon_regular'
                                ? 'Regular (R) Insulin (Midday)'
                                : item.insulin.insulin_type === 'night_30_70'
                                ? '30/70 Biphasic Mix'
                                : 'Correction / As-Needed Dose'}
                            </div>
                            <div className="font-label-md text-xs text-on-surface-variant">
                              {item.insulin.note || 'Subcutaneous injection · Standard pre-meal timing'}
                            </div>
                          </div>
                        </div>
                      )}

                      {isFood && item.food && (
                        <div>
                          <p className="font-body-md text-sm text-on-surface pb-2 font-medium">
                            {item.food.items}
                          </p>
                          {item.food.note && (
                            <p className="text-xs text-on-surface-variant pb-2">{item.food.note}</p>
                          )}
                          <div className="flex items-center gap-2 flex-wrap font-label-md text-xs pt-1">
                            <span className="px-2.5 py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant">
                              {item.food.carb_size === 'large' ? '~95g Fast Carbs' : item.food.carb_size === 'medium' ? '~60g Carbs' : '~30g Carbs'}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant">
                              PG Dining Hall
                            </span>
                          </div>
                        </div>
                      )}

                      {isFeel && item.feel && (
                        <div>
                          <p className="font-body-md text-sm text-on-surface pb-2">
                            {item.feel.note || 'Felt bodily shift during daily routine.'}
                          </p>
                          <div className="flex items-center gap-1.5 flex-wrap font-label-md text-xs pt-1">
                            {item.feel.symptoms.map((s) => (
                              <span
                                key={s}
                                className="px-2.5 py-0.5 rounded-full bg-tertiary-container/20 text-tertiary font-semibold border border-tertiary/20"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {isGlucose && item.glucose && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                          <div>
                            <div className="flex items-baseline gap-2">
                              <span className="font-display-lg text-4xl text-secondary font-extrabold tracking-tight">
                                {item.glucose.reading_mgdl}
                              </span>
                              <span className="font-headline-sm text-sm text-on-surface-variant font-medium">mg/dL</span>
                            </div>
                            <p className="font-body-md text-xs text-on-surface-variant mt-1">
                              {item.glucose.note || 'Accu-Chek Instant Meter reading. Expected post-meal trajectory.'}
                            </p>
                          </div>
                          <div className="p-3 rounded-2xl bg-surface-container-lowest/80 border border-white/5 flex flex-col items-center justify-center min-w-[130px]">
                            <div className="w-full flex justify-between text-[0.65rem] font-label-md text-on-surface-variant pb-1">
                              <span>Target</span>
                              <span>70 - 180</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-surface-container-high overflow-hidden">
                              <div
                                className="h-full bg-secondary rounded-full"
                                style={{ width: `${Math.min(100, (item.glucose.reading_mgdl / 240) * 100)}%` }}
                              ></div>
                            </div>
                            <div className="font-label-md text-xs text-secondary font-medium pt-1.5 text-center">
                              {item.glucose.reading_mgdl > 180
                                ? `+${item.glucose.reading_mgdl - 180} mg/dL over target`
                                : 'In target range ✓'}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT: INSIGHTS & CONTEXT SIDEBAR (Col 4) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Day Rhythm Snapshot Card */}
          <div className="bg-surface-container-low/80 backdrop-blur-2xl p-5 md:p-6 rounded-3xl border border-white/5 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between pb-2">
              <span className="font-headline-sm text-sm text-on-surface font-bold">Day Rhythm Curve</span>
              <span className="px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-md text-[0.7rem] border border-white/5">
                Felt Energy vs Glycemia
              </span>
            </div>
            <p className="font-label-md text-xs text-on-surface-variant pb-3">
              Continuous subjective wellbeing curve synthesized across check-ins and meal timing.
            </p>

            {/* Inline SVG Curve Chart */}
            <div className="w-full h-36 relative flex items-center justify-center">
              <svg className="w-full h-full overflow-visible" fill="none" viewBox="0 0 320 120" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="curveGradient" x1="0%" x2="0%" y1="0%" y2="100%">
                    <stop offset="0%" stopColor="#4edea3" stopOpacity="0.35"></stop>
                    <stop offset="50%" stopColor="#ffb95f" stopOpacity="0.2"></stop>
                    <stop offset="100%" stopColor="#4cd7f6" stopOpacity="0.0"></stop>
                  </linearGradient>
                </defs>
                {/* Target Comfort Zone Fill */}
                <rect fill="#4edea3" fillOpacity="0.05" height="45" rx="6" width="320" x="0" y="35"></rect>
                <line stroke="#3c4a42" strokeDasharray="3 3" strokeOpacity="0.3" x1="0" x2="320" y1="35" y2="35"></line>
                <line stroke="#3c4a42" strokeDasharray="3 3" strokeOpacity="0.3" x1="0" x2="320" y1="80" y2="80"></line>
                {/* Area under path */}
                <path d="M 0,55 C 40,25 60,30 90,45 C 130,55 160,85 200,98 C 240,110 270,60 320,48 L 320,120 L 0,120 Z" fill="url(#curveGradient)"></path>
                {/* Spline line */}
                <path d="M 0,55 C 40,25 60,30 90,45 C 130,55 160,85 200,98 C 240,110 270,60 320,48" stroke="#4edea3" strokeLinecap="round" strokeWidth="3"></path>
                {/* Event Highlight Dots */}
                <circle cx="25" cy="40" fill="#4cd7f6" r="4" stroke="#0b1326" strokeWidth="2"></circle>
                <circle cx="70" cy="38" fill="#ffb95f" r="4" stroke="#0b1326" strokeWidth="2"></circle>
                <circle cx="200" cy="98" fill="#ffb95f" r="5" stroke="#0b1326" strokeWidth="2"></circle>
                <circle cx="270" cy="60" fill="#4cd7f6" r="4" stroke="#0b1326" strokeWidth="2"></circle>
              </svg>
            </div>

            <div className="flex justify-between text-[0.65rem] text-outline font-label-md mt-2">
              <span>07:00 AM (Run)</span>
              <span>12:30 PM (Lunch)</span>
              <span className="text-tertiary font-bold">04:30 PM (Peak)</span>
              <span>08:30 PM (Dinner)</span>
            </div>
          </div>

          {/* Bangalore PG Routine Log Notes */}
          <div className="bg-surface-container-low/80 backdrop-blur-2xl p-5 md:p-6 rounded-3xl border border-white/5 shadow-xl">
            <div className="flex items-center justify-between pb-3">
              <span className="font-headline-sm text-sm text-on-surface font-bold">Bangalore PG Context</span>
              <span className="material-symbols-outlined text-secondary text-base">domain</span>
            </div>
            <div className="space-y-3 text-xs text-on-surface-variant">
              <div className="p-3 rounded-xl bg-surface-container-lowest/60 border border-white/5">
                <span className="text-secondary font-bold block mb-0.5">Mess Meal Routine</span>
                Parboiled rice staple with high glycemic load. Curd &amp; cucumber slices buffer absorption.
              </div>
              <div className="p-3 rounded-xl bg-surface-container-lowest/60 border border-white/5">
                <span className="text-primary font-bold block mb-0.5">Post-Exertion Calisthenics</span>
                Terrace pull-ups &amp; core planking at 6:15 PM restores insulin sensitivity before dinner dose.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Sheets & Confirmation Dialogs */}
      <FoodSheet
        isOpen={isFoodOpen}
        onClose={() => {
          setIsFoodOpen(false);
          setEditingFood(null);
        }}
        onSaved={refreshLogs}
        dateStr={selectedDate}
        initialData={editingFood}
      />
      <ActivitySheet
        isOpen={isActivityOpen}
        onClose={() => {
          setIsActivityOpen(false);
          setEditingActivity(null);
        }}
        onSaved={refreshLogs}
        dateStr={selectedDate}
        initialData={editingActivity}
      />
      <FeelSheet
        isOpen={isFeelOpen}
        onClose={() => {
          setIsFeelOpen(false);
          setEditingFeel(null);
        }}
        onSaved={refreshLogs}
        dateStr={selectedDate}
        initialData={editingFeel}
      />
      <GlucoseSheet
        isOpen={isGlucoseOpen}
        onClose={() => {
          setIsGlucoseOpen(false);
          setEditingGlucose(null);
        }}
        onSaved={refreshLogs}
        dateStr={selectedDate}
        initialData={editingGlucose}
      />
      <InsulinSheet
        isOpen={isInsulinOpen}
        onClose={() => {
          setIsInsulinOpen(false);
          setEditingInsulin(null);
        }}
        onSaved={refreshLogs}
        dateStr={selectedDate}
        type={insulinModalType}
        initialData={editingInsulin}
      />
      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        title="Delete Timeline Entry"
        message="Are you sure you want to remove this logged entry from your timeline?"
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
