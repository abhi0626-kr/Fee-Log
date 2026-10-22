'use client';

import React, { useState, useEffect } from 'react';
import { X, Activity as ActivityIcon, Zap } from 'lucide-react';
import { ActivityType, IntensityType, ActivityLog } from '@/types';
import { getCurrentTimeIST } from '@/lib/date-utils';
import { saveActivityLog } from '@/lib/sync-storage';

interface ActivitySheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  dateStr: string;
  initialData?: ActivityLog | null;
}

export default function ActivitySheet({
  isOpen,
  onClose,
  onSaved,
  dateStr,
  initialData,
}: ActivitySheetProps) {
  const [activityType, setActivityType] = useState<ActivityType>('run');
  const [logTime, setLogTime] = useState<string>(getCurrentTimeIST());
  const [durationMin, setDurationMin] = useState<number>(45);
  const [intensity, setIntensity] = useState<IntensityType>('moderate');
  const [note, setNote] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setActivityType(initialData.activity_type);
        setLogTime(initialData.log_time);
        setDurationMin(initialData.duration_min);
        setIntensity(initialData.intensity || 'moderate');
        setNote(initialData.note || '');
      } else {
        setActivityType('run');
        setLogTime(getCurrentTimeIST());
        setDurationMin(45);
        setIntensity('moderate');
        setNote('');
      }
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (durationMin <= 0) return;

    saveActivityLog({
      id: initialData?.id,
      user_id: initialData?.user_id || 'user-1',
      log_date: dateStr,
      log_time: logTime,
      activity_type: activityType,
      duration_min: Number(durationMin),
      intensity,
      note: note.trim() || null,
    });

    onSaved();
    onClose();
  };

  const activityOptions: { id: ActivityType; label: string }[] = [
    { id: 'run', label: 'Run' },
    { id: 'calisthenics', label: 'Calisthenics' },
    { id: 'walk', label: 'Walk' },
    { id: 'other', label: 'Other' },
  ];

  const intensityOptions: { id: IntensityType; label: string }[] = [
    { id: 'light', label: 'Light' },
    { id: 'moderate', label: 'Moderate' },
    { id: 'hard', label: 'Hard' },
  ];

  const handleQuickPrefill = (type: ActivityType, mins: number, noteText: string) => {
    setActivityType(type);
    setDurationMin(mins);
    setIntensity('moderate');
    setNote(noteText);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-6 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <ActivityIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                {initialData ? 'Edit Activity Log' : 'Log Physical Activity'}
              </h2>
              <p className="text-xs text-slate-500">Track runs, calisthenics, and workouts</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Quick Pre-fill Chips */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Quick Pre-fills
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickPrefill('run', 45, 'Morning run (5–10 km)')}
                className="p-2.5 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 text-left hover:bg-blue-100 transition-colors"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <Zap className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  Morning run
                </div>
                <div className="text-[10px] text-blue-600/80 dark:text-blue-400/80 mt-0.5">
                  5–10 km · 45 min
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickPrefill('calisthenics', 40, 'Evening calisthenics (30–45 min)')}
                className="p-2.5 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/70 dark:bg-indigo-950/30 text-indigo-800 dark:text-indigo-300 text-left hover:bg-indigo-100 transition-colors"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <Zap className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  Calisthenics
                </div>
                <div className="text-[10px] text-indigo-600/80 dark:text-indigo-400/80 mt-0.5">
                  30–45 min · Terrace
                </div>
              </button>
            </div>
          </div>

          {/* Activity Type Segmented */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Activity Type
            </label>
            <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              {activityOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setActivityType(opt.id)}
                  className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                    activityType === opt.id
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Duration & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Duration (minutes)
              </label>
              <input
                type="number"
                min="1"
                max="360"
                value={durationMin}
                onChange={(e) => setDurationMin(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Time (IST)
              </label>
              <input
                type="time"
                value={logTime}
                onChange={(e) => setLogTime(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          {/* Intensity Segmented */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Intensity
            </label>
            <div className="grid grid-cols-3 gap-2">
              {intensityOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setIntensity(opt.id)}
                  className={`py-2 text-xs font-semibold rounded-xl border transition-all ${
                    intensity === opt.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 ring-2 ring-blue-400/30'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Note (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. 7 km run, felt strong, drank electrolyte water"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-[0.99] min-h-[48px]"
            >
              {initialData ? 'Update Activity Log' : 'Save Activity Log'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
