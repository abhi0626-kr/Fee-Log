'use client';

import React, { useState, useEffect } from 'react';
import { ActivityType, IntensityType, ActivityLog } from '@/types';
import { getCurrentTimeIST } from '@/lib/date-utils';
import { saveActivityLog, getActiveUserId } from '@/lib/sync-storage';

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

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (durationMin <= 0) return;

    saveActivityLog({
      id: initialData?.id,
      user_id: initialData?.user_id || getActiveUserId(),
      log_date: initialData?.log_date || dateStr,
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

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface-container/95 border border-white/10 text-on-surface w-full max-w-lg rounded-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-surface-container-high shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-secondary-container/20 text-secondary border border-secondary/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">directions_run</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-on-surface">
                {initialData ? 'Edit Activity Log' : 'Log Physical Activity'}
              </h2>
              <p className="text-xs text-on-surface-variant">Morning run, terrace calisthenics, or walking</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-full flex items-center gap-1 text-xs font-semibold bg-surface-container-high hover:bg-surface-bright text-on-surface-variant hover:text-on-surface transition-colors border border-white/5 cursor-pointer"
            title="Cancel and close"
          >
            <span className="material-symbols-outlined text-sm">close</span>
            <span>Cancel</span>
          </button>
        </div>

        {/* Quick Presets */}
        <div className="px-6 pt-4 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setActivityType('run');
              setDurationMin(45);
              setIntensity('moderate');
              setNote('Cubbon Park 8km aerobic loop');
            }}
            className="px-3 py-1 rounded-full text-xs font-semibold bg-secondary-container/15 text-secondary border border-secondary/20 hover:bg-secondary-container/25 transition-colors"
          >
            + Cubbon Park 8k Run
          </button>
          <button
            type="button"
            onClick={() => {
              setActivityType('calisthenics');
              setDurationMin(35);
              setIntensity('moderate');
              setNote('PG Terrace pull-ups & core routine');
            }}
            className="px-3 py-1 rounded-full text-xs font-semibold bg-secondary-container/15 text-secondary border border-secondary/20 hover:bg-secondary-container/25 transition-colors"
          >
            + Terrace Calisthenics
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Activity Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
              Activity Type
            </label>
            <div className="grid grid-cols-4 gap-1.5 p-1 bg-surface-container-low rounded-2xl border border-white/5">
              {activityOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setActivityType(opt.id)}
                  className={`py-2 text-xs font-bold rounded-xl transition-all ${
                    activityType === opt.id
                      ? 'bg-secondary text-on-secondary shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time & Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
                Time (IST)
              </label>
              <input
                type="time"
                value={logTime}
                onChange={(e) => setLogTime(e.target.value)}
                className="w-full px-4 py-2.5 bg-surface-container-low border border-white/10 rounded-xl text-sm font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
                Duration (min)
              </label>
              <input
                type="number"
                min={1}
                max={300}
                value={durationMin}
                onChange={(e) => setDurationMin(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-surface-container-low border border-white/10 rounded-xl text-sm font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary"
                required
              />
            </div>
          </div>

          {/* Intensity Segmented */}
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
              Exertion Intensity
            </label>
            <div className="grid grid-cols-3 gap-2">
              {intensityOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setIntensity(opt.id)}
                  className={`p-3 rounded-2xl border text-center transition-all ${
                    intensity === opt.id
                      ? 'border-secondary bg-secondary-container/20 text-on-surface shadow-md font-bold'
                      : 'border-white/5 bg-surface-container-low text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <div className="text-xs">{opt.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
              Route &amp; Context Notes (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. 5'10 pace, cool morning, hydrated well"
              className="w-full px-4 py-2.5 bg-surface-container-low border border-white/10 rounded-xl text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-secondary"
            />
          </div>

          <div className="pt-2 flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-full bg-surface-container-high hover:bg-surface-bright text-on-surface font-semibold text-xs sm:text-sm transition-all border border-white/10 active:scale-95 cursor-pointer text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-[2] py-3 rounded-full bg-secondary-container text-on-secondary-container hover:bg-secondary hover:text-on-secondary font-bold text-xs sm:text-sm shadow-lg transition-all active:scale-95 cursor-pointer"
            >
              {initialData ? 'Update Activity Log' : 'Save Activity Log'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
