'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Syringe,
  Utensils,
  Activity as ActivityIcon,
  HeartPulse,
  Droplets,
  Edit2,
  Trash2,
} from 'lucide-react';
import {
  getTodayIST,
  formatISTDate,
  formatISTTime,
  shiftDate,
  timeDiffMinutes,
} from '@/lib/date-utils';
import {
  getUnifiedLogsForDate,
  getSettings,
  DEFAULT_SETTINGS,
  deleteInsulinLog,
  deleteFoodLog,
  deleteActivityLog,
  deleteFeelLog,
  deleteGlucoseLog,
} from '@/lib/sync-storage';
import {
  UnifiedLogItem,
  UserSettings,
  FoodLog,
  ActivityLog,
  FeelLog,
  GlucoseLog,
  InsulinLog,
  FEEL_COLORS,
} from '@/types';
import FoodSheet from '@/components/FoodSheet';
import ActivitySheet from '@/components/ActivitySheet';
import FeelSheet from '@/components/FeelSheet';
import GlucoseSheet from '@/components/GlucoseSheet';
import InsulinSheet from '@/components/InsulinSheet';
import DeleteConfirmModal from '@/components/DeleteConfirmModal';

export default function TimelinePage() {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayIST());
  const [logs, setLogs] = useState<UnifiedLogItem[]>([]);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);

  // Sheet states
  const [isFoodOpen, setIsFoodOpen] = useState(false);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [isFeelOpen, setIsFeelOpen] = useState(false);
  const [isGlucoseOpen, setIsGlucoseOpen] = useState(false);
  const [isInsulinOpen, setIsInsulinOpen] = useState(false);
  const [insulinModalType, setInsulinModalType] = useState<'morning_regular' | 'night_30_70'>('morning_regular');

  const [editingFood, setEditingFood] = useState<FoodLog | null>(null);
  const [editingActivity, setEditingActivity] = useState<ActivityLog | null>(null);
  const [editingFeel, setEditingFeel] = useState<FeelLog | null>(null);
  const [editingGlucose, setEditingGlucose] = useState<GlucoseLog | null>(null);
  const [editingInsulin, setEditingInsulin] = useState<InsulinLog | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<UnifiedLogItem | null>(null);

  const refreshLogs = useCallback(() => {
    const dayLogs = getUnifiedLogsForDate(selectedDate);
    setLogs(dayLogs);
    setSettings(getSettings());
  }, [selectedDate]);

  useEffect(() => {
    refreshLogs();
  }, [refreshLogs]);

  const handlePrevDay = () => setSelectedDate((d) => shiftDate(d, -1));
  const handleNextDay = () => setSelectedDate((d) => shiftDate(d, 1));
  const handleToday = () => setSelectedDate(getTodayIST());

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

  // Pair feel and glucose logs that are within 30 minutes
  // We identify paired feel and glucose logs to highlight them side by side
  const pairedGlucoseIds = new Set<string>();
  const feelWithPairedGlucose = new Map<string, GlucoseLog>();

  const feelItems = logs.filter((l) => l.category === 'feel' && l.feel);
  const glucoseItems = logs.filter((l) => l.category === 'glucose' && l.glucose);

  feelItems.forEach((f) => {
    for (const g of glucoseItems) {
      if (!pairedGlucoseIds.has(g.id) && timeDiffMinutes(f.log_time, g.log_time) <= 30) {
        pairedGlucoseIds.add(g.id);
        feelWithPairedGlucose.set(f.id, g.glucose!);
        break;
      }
    }
  });

  return (
    <div className="pb-28 max-w-lg mx-auto px-4 pt-4">
      {/* Date Header with Prev / Next */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-3.5 shadow-sm mb-5">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handlePrevDay}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            aria-label="Previous day"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-teal-600 dark:text-teal-400">
              <Calendar className="w-3.5 h-3.5" />
              <span>Day Timeline</span>
            </div>
            <h1 className="text-base font-black text-slate-900 dark:text-slate-100">
              {formatISTDate(selectedDate, { weekday: 'short', month: 'short', day: 'numeric' })}
            </h1>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleToday}
              className={`px-2 py-1 text-[11px] font-bold rounded-lg border transition-all ${
                selectedDate === getTodayIST()
                  ? 'bg-teal-50 border-teal-200 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300'
                  : 'text-slate-500 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={handleNextDay}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              aria-label="Next day"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Visual Timeline Section */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-4 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-slate-700">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
            Chronological Timeline (05:00 – 24:00)
          </span>
          <span className="text-[10px] text-slate-400">
            {logs.length} marker{logs.length !== 1 ? 's' : ''}
          </span>
        </div>

        {logs.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            No events logged for this date.
          </div>
        ) : (
          <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
            {logs.map((item) => {
              // Check if this is a glucose item already rendered beside a feel log
              if (item.category === 'glucose' && pairedGlucoseIds.has(item.id)) {
                // If paired with a feel log, it is rendered side-by-side with that feel log
                return null;
              }

              const pairedGlucose = item.category === 'feel' ? feelWithPairedGlucose.get(item.id) : null;

              return (
                <div key={item.id} className="relative group flex items-start gap-3">
                  {/* Timeline bullet / icon */}
                  {item.category === 'insulin' && (
                    <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center ring-4 ring-white dark:ring-slate-800 shadow-sm">
                      <Syringe className="w-2.5 h-2.5" />
                    </div>
                  )}

                  {item.category === 'food' && (
                    <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center ring-4 ring-white dark:ring-slate-800 shadow-sm">
                      <Utensils className="w-2.5 h-2.5" />
                    </div>
                  )}

                  {item.category === 'activity' && (
                    <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center ring-4 ring-white dark:ring-slate-800 shadow-sm">
                      <ActivityIcon className="w-2.5 h-2.5" />
                    </div>
                  )}

                  {item.category === 'feel' && item.feel && (
                    <div
                      className={`absolute -left-6 top-1 w-5 h-5 rounded-full ${
                        FEEL_COLORS[item.feel.feel].bg
                      } text-white flex items-center justify-center ring-4 ring-white dark:ring-slate-800 shadow-sm`}
                    >
                      <HeartPulse className="w-2.5 h-2.5" />
                    </div>
                  )}

                  {item.category === 'glucose' && item.glucose && (
                    <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center ring-4 ring-white dark:ring-slate-800 shadow-sm">
                      <Droplets className="w-2.5 h-2.5" />
                    </div>
                  )}

                  {/* Marker Content Card */}
                  <div
                    onClick={() => handleEditItem(item)}
                    className="flex-1 bg-slate-50 dark:bg-slate-750/70 p-3 rounded-xl border border-slate-100 dark:border-slate-700/60 hover:border-slate-300 transition-all cursor-pointer shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-900 dark:text-slate-100">
                          {formatISTTime(item.log_time)}
                        </span>

                        {/* Category specific header tag */}
                        {item.category === 'insulin' && item.insulin && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300">
                            {item.insulin.insulin_type === 'morning_regular' ? 'Morning Regular' : 'Night 30/70'} · {item.insulin.units} U
                          </span>
                        )}

                        {item.category === 'food' && item.food && (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                              {item.food.meal}
                            </span>
                            {item.food.carb_size && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                {item.food.carb_size} carb
                              </span>
                            )}
                          </div>
                        )}

                        {item.category === 'activity' && item.activity && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                            {item.activity.activity_type.toUpperCase()} · {item.activity.duration_min} min
                          </span>
                        )}

                        {item.category === 'feel' && item.feel && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                FEEL_COLORS[item.feel.feel].badge
                              }`}
                            >
                              Feel: {FEEL_COLORS[item.feel.feel].label}
                            </span>

                            {/* Visually paired Glucose reading if within 30 min */}
                            {pairedGlucose && (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 flex items-center gap-1 animate-pulse">
                                <Droplets className="w-2.5 h-2.5" />
                                {pairedGlucose.reading_mgdl} mg/dL (Paired at {pairedGlucose.log_time})
                              </span>
                            )}
                          </div>
                        )}

                        {item.category === 'glucose' && item.glucose && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                            {item.glucose.reading_mgdl} mg/dL
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Details / Notes */}
                    <div className="mt-1 text-xs text-slate-700 dark:text-slate-300">
                      {item.category === 'food' && item.food && (
                        <p className="font-semibold text-slate-800 dark:text-slate-200">
                          {item.food.items}
                        </p>
                      )}

                      {item.category === 'feel' && item.feel && item.feel.symptoms?.length > 0 && (
                        <p className="text-[11px] text-slate-500">
                          Symptoms: {item.feel.symptoms.join(', ')}
                        </p>
                      )}

                      {/* Display note if any */}
                      {(item.insulin?.note ||
                        item.food?.note ||
                        item.activity?.note ||
                        item.feel?.note ||
                        item.glucose?.note) && (
                        <p className="text-[10px] text-slate-500 italic mt-0.5">
                          Note: {item.insulin?.note ||
                            item.food?.note ||
                            item.activity?.note ||
                            item.feel?.note ||
                            item.glucose?.note}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Compact Table of That Day's Logs */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-4 shadow-sm">
        <h2 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
          Daily Log Table
        </h2>

        {logs.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">No data logged.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 text-[10px] uppercase">
                  <th className="py-2 pr-2">Time</th>
                  <th className="py-2 pr-2">Category</th>
                  <th className="py-2 pr-2">Summary</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-750">
                {logs.map((item) => {
                  let summary = '';
                  if (item.category === 'insulin' && item.insulin) {
                    summary = `${item.insulin.insulin_type === 'morning_regular' ? 'Morning Reg' : 'Night 30/70'}: ${item.insulin.units}U`;
                  } else if (item.category === 'food' && item.food) {
                    summary = `${item.food.meal}: ${item.food.items}`;
                  } else if (item.category === 'activity' && item.activity) {
                    summary = `${item.activity.activity_type}: ${item.activity.duration_min}m`;
                  } else if (item.category === 'feel' && item.feel) {
                    summary = `Feel: ${FEEL_COLORS[item.feel.feel].label}`;
                  } else if (item.category === 'glucose' && item.glucose) {
                    summary = `${item.glucose.reading_mgdl} mg/dL`;
                  }

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 pr-2 font-bold text-slate-900 dark:text-slate-100">
                        {item.log_time}
                      </td>
                      <td className="py-2.5 pr-2 uppercase font-semibold text-[10px] text-slate-500">
                        {item.category}
                      </td>
                      <td className="py-2.5 pr-2 text-slate-700 dark:text-slate-300 font-medium truncate max-w-[150px]">
                        {summary}
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleEditItem(item)}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded"
                            aria-label="Edit entry"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(item)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded"
                            aria-label="Delete entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sheets */}
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
      />
    </div>
  );
}
