'use client';

import React, { useState, useEffect } from 'react';
import { X, Syringe } from 'lucide-react';
import { InsulinType, InsulinLog } from '@/types';
import { getCurrentTimeIST } from '@/lib/date-utils';
import { saveInsulinLog } from '@/lib/sync-storage';

interface InsulinSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  dateStr: string;
  insulinType: InsulinType;
  defaultUnits: number;
  initialData?: InsulinLog | null;
}

export default function InsulinSheet({
  isOpen,
  onClose,
  onSaved,
  dateStr,
  insulinType,
  defaultUnits,
  initialData,
}: InsulinSheetProps) {
  const [units, setUnits] = useState<number>(defaultUnits);
  const [logTime, setLogTime] = useState<string>(getCurrentTimeIST());
  const [taken, setTaken] = useState<boolean>(true);
  const [note, setNote] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setUnits(initialData.units);
        setLogTime(initialData.log_time);
        setTaken(initialData.taken);
        setNote(initialData.note || '');
      } else {
        setUnits(defaultUnits);
        setLogTime(getCurrentTimeIST());
        setTaken(true);
        setNote('');
      }
    }
  }, [isOpen, initialData, defaultUnits]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (units <= 0) return;

    saveInsulinLog({
      id: initialData?.id,
      user_id: initialData?.user_id || 'user-1',
      log_date: dateStr,
      log_time: logTime,
      insulin_type: insulinType,
      units: Number(units),
      taken,
      note: note.trim() || null,
    });

    onSaved();
    onClose();
  };

  const isMorning = insulinType === 'morning_regular';
  const label = isMorning ? 'Morning · Regular (R)' : 'Night · Biphasic 30/70';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-6 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <Syringe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                {label}
              </h2>
              <p className="text-xs text-slate-500">Record dose confirmation & time</p>
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
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/40 rounded-xl text-xs text-amber-900 dark:text-amber-200">
            <strong>Fixed regimen record:</strong> App never suggests dose adjustments. Always follow your endocrinologist&apos;s guidance.
          </div>

          {/* Units */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Units Injected
            </label>
            <div className="relative">
              <input
                type="number"
                min="0.5"
                max="100"
                step="0.5"
                value={units}
                onChange={(e) => setUnits(Number(e.target.value))}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-2xl font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                Units (U)
              </span>
            </div>
          </div>

          {/* Time & Taken Toggle */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Injection Time (IST)
              </label>
              <input
                type="time"
                value={logTime}
                onChange={(e) => setLogTime(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Status
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTaken(true)}
                  className={`flex-1 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                    taken
                      ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 ring-2 ring-teal-400/30'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600'
                  }`}
                >
                  Taken ✓
                </button>
                <button
                  type="button"
                  onClick={() => setTaken(false)}
                  className={`flex-1 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                    !taken
                      ? 'border-red-500 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 ring-2 ring-red-400/30'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600'
                  }`}
                >
                  Skipped
                </button>
              </div>
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
              placeholder="e.g. Injected 15 min before eating PG breakfast"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-[0.99] min-h-[48px]"
            >
              {initialData ? 'Update Insulin Log' : 'Confirm Insulin Log'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
