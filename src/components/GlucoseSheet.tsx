'use client';

import React, { useState, useEffect } from 'react';
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-md p-0 sm:p-4">
      <div className="bg-surface-container/95 border border-white/10 text-on-surface w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-6 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-container-high">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-secondary/20 text-secondary border border-secondary/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">bloodtype</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-on-surface">
                {initialData ? 'Edit Meter Reading' : 'Log Blood Glucose (Optional)'}
              </h2>
              <p className="text-xs text-on-surface-variant">
                Zero pressure. Enter spot check if you have an Accu-Chek or lab value.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Large Reading Input */}
          <div className="p-4 rounded-2xl bg-surface-container-low border border-secondary/20 text-center">
            <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
              Blood Glucose Value (mg/dL)
            </label>
            <div className="flex items-baseline justify-center gap-2">
              <input
                type="number"
                min={20}
                max={800}
                value={reading}
                onChange={(e) => setReading(e.target.value)}
                placeholder="140"
                className="w-36 text-center text-4xl font-extrabold bg-transparent text-secondary border-b-2 border-secondary focus:outline-none"
                required
                autoFocus
              />
              <span className="text-base font-semibold text-on-surface-variant">mg/dL</span>
            </div>
          </div>

          {/* Time & Context */}
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
                Context
              </label>
              <select
                value={context}
                onChange={(e) => setContext(e.target.value as GlucoseContext)}
                className="w-full px-4 py-2.5 bg-surface-container-low border border-white/10 rounded-xl text-sm font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary"
              >
                {contextOptions.map((opt) => (
                  <option key={opt.id} value={opt.id} className="bg-surface-container">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
              Note (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Spot-check at friend's room"
              className="w-full px-4 py-2.5 bg-surface-container-low border border-white/10 rounded-xl text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-secondary"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3 rounded-full bg-secondary-container text-on-secondary-container hover:bg-secondary hover:text-on-secondary font-bold text-sm shadow-lg transition-all active:scale-95"
            >
              {initialData ? 'Update Glucose Reading' : 'Save Glucose Reading'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
