'use client';

import React, { useState, useEffect } from 'react';
import { X, Droplets } from 'lucide-react';
import { GlucoseContext, GlucoseLog } from '@/types';
import { getCurrentTimeIST } from '@/lib/date-utils';
import { saveGlucoseLog } from '@/lib/sync-storage';

interface GlucoseSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  dateStr: string;
  initialData?: GlucoseLog | null;
}

export default function GlucoseSheet({
  isOpen,
  onClose,
  onSaved,
  dateStr,
  initialData,
}: GlucoseSheetProps) {
  const [reading, setReading] = useState<string>('');
  const [logTime, setLogTime] = useState<string>(getCurrentTimeIST());
  const [context, setContext] = useState<GlucoseContext>('post_lunch');
  const [note, setNote] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setReading(String(initialData.reading_mgdl));
        setLogTime(initialData.log_time);
        setContext(initialData.context || 'post_lunch');
        setNote(initialData.note || '');
      } else {
        setReading('');
        setLogTime(getCurrentTimeIST());
        setContext('post_lunch');
        setNote('');
      }
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(reading, 10);
    if (isNaN(val) || val < 20 || val > 800) return;

    saveGlucoseLog({
      id: initialData?.id,
      user_id: initialData?.user_id || 'user-1',
      log_date: dateStr,
      log_time: logTime,
      reading_mgdl: val,
      context,
      note: note.trim() || null,
    });

    onSaved();
    onClose();
  };

  const contextOptions: { id: GlucoseContext; label: string }[] = [
    { id: 'fasting', label: 'Fasting' },
    { id: 'post_lunch', label: 'Post-Lunch' },
    { id: 'pre_bed', label: 'Pre-Bed' },
    { id: 'other', label: 'Other' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-6 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <Droplets className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                {initialData ? 'Edit Glucose Reading' : 'Log Blood Glucose (Optional)'}
              </h2>
              <p className="text-xs text-slate-500">
                Enter fingerstick or meter reading if available
              </p>
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
          {/* Reading Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Glucose Reading (mg/dL)
            </label>
            <div className="relative">
              <input
                type="number"
                min="20"
                max="800"
                value={reading}
                onChange={(e) => setReading(e.target.value)}
                placeholder="e.g. 185"
                autoFocus
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-2xl font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                required
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                mg/dL
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Accepted range: 20 – 800 mg/dL
            </p>
          </div>

          {/* Time & Context */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Time (IST)
              </label>
              <input
                type="time"
                value={logTime}
                onChange={(e) => setLogTime(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Context
              </label>
              <select
                value={context}
                onChange={(e) => setContext(e.target.value as GlucoseContext)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                {contextOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
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
              placeholder="e.g. Checked at pharmacy or friend's glucometer"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={!reading}
              className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-bold rounded-xl shadow-md transition-all active:scale-[0.99] min-h-[48px]"
            >
              {initialData ? 'Update Glucose Reading' : 'Save Glucose Reading'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
