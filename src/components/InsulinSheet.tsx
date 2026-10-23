'use client';

import React, { useState, useEffect } from 'react';
import { InsulinType, InsulinLog } from '@/types';
import { getCurrentTimeIST } from '@/lib/date-utils';
import { saveInsulinLog, getSettings, getActiveUserId } from '@/lib/sync-storage';

interface InsulinSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  dateStr: string;
  type?: InsulinType;
  insulinType?: InsulinType;
  defaultUnits?: number;
  initialData?: InsulinLog | null;
}

const DOSE_OPTIONS: { id: InsulinType; label: string; sub: string; defaultU: number }[] = [
  { id: 'morning_regular', label: 'Morning Regular (R)', sub: 'Before breakfast', defaultU: 20 },
  { id: 'afternoon_regular', label: 'Afternoon / Midday', sub: 'Before lunch or rise', defaultU: 10 },
  { id: 'night_30_70', label: 'Night 30/70 Biphasic', sub: 'Before dinner', defaultU: 25 },
  { id: 'correction', label: 'Correction / As Needed', sub: 'Based on high BG / feel', defaultU: 4 },
];

export default function InsulinSheet({
  isOpen,
  onClose,
  onSaved,
  dateStr,
  type,
  insulinType: propInsulinType,
  defaultUnits,
  initialData,
}: InsulinSheetProps) {
  const initialType = propInsulinType || type || 'morning_regular';
  const [selectedType, setSelectedType] = useState<InsulinType>(initialType);
  const [units, setUnits] = useState<number>(20);
  const [logTime, setLogTime] = useState<string>(getCurrentTimeIST());
  const [taken, setTaken] = useState<boolean>(true);
  const [note, setNote] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      const st = getSettings();
      const currentType = propInsulinType || type || 'morning_regular';
      setSelectedType(currentType);

      if (initialData) {
        setSelectedType(initialData.insulin_type);
        setUnits(initialData.units);
        setLogTime(initialData.log_time);
        setTaken(initialData.taken);
        setNote(initialData.note || '');
      } else {
        let fallbackUnits = defaultUnits;
        if (!fallbackUnits) {
          if (currentType === 'morning_regular') fallbackUnits = st.morning_regular_units;
          else if (currentType === 'night_30_70') fallbackUnits = st.night_30_70_units;
          else if (currentType === 'afternoon_regular') fallbackUnits = st.afternoon_regular_units ?? 10;
          else fallbackUnits = 4;
        }

        setUnits(fallbackUnits);
        setLogTime(getCurrentTimeIST());
        setTaken(true);
        setNote(
          currentType === 'morning_regular'
            ? 'Administered 20m before PG breakfast'
            : currentType === 'afternoon_regular'
            ? 'Midday dose before lunch'
            : currentType === 'night_30_70'
            ? 'Administered 15m before PG dinner'
            : 'Correction dose based on body condition'
        );
      }
    }
  }, [isOpen, initialData, defaultUnits, propInsulinType, type]);

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
    if (units <= 0) return;

    saveInsulinLog({
      id: initialData?.id,
      user_id: initialData?.user_id || getActiveUserId(),
      log_date: dateStr,
      log_time: logTime,
      insulin_type: selectedType,
      units: Number(units),
      taken,
      note: note.trim() || null,
    });

    onSaved();
    onClose();
  };

  const isMorning = selectedType === 'morning_regular';
  const isNight = selectedType === 'night_30_70';
  const isAfternoon = selectedType === 'afternoon_regular';
  const themeColor = isMorning ? 'text-primary' : isNight ? 'text-secondary' : isAfternoon ? 'text-tertiary' : 'text-primary';
  const themeBorder = isMorning ? 'border-primary/20' : isNight ? 'border-secondary/20' : isAfternoon ? 'border-tertiary/20' : 'border-primary/20';

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
            <div className={`w-10 h-10 rounded-full bg-surface-container-high ${themeColor} border ${themeBorder} flex items-center justify-center`}>
              <span className="material-symbols-outlined text-xl">vaccines</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-on-surface">
                {initialData ? 'Edit Insulin Dose' : 'Log Insulin Dose'}
              </h2>
              <p className="text-xs text-on-surface-variant">Adjust units day-to-day based on body condition</p>
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Dose Type Segmented Selector */}
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
              Dose Time &amp; Regimen Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {DOSE_OPTIONS.map((opt) => {
                const isActive = selectedType === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSelectedType(opt.id);
                      if (!initialData) {
                        const st = getSettings();
                        if (opt.id === 'morning_regular') setUnits(st.morning_regular_units);
                        else if (opt.id === 'night_30_70') setUnits(st.night_30_70_units);
                        else if (opt.id === 'afternoon_regular') setUnits(st.afternoon_regular_units ?? 10);
                        else setUnits(4);
                      }
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      isActive
                        ? 'bg-surface-container-high border-primary/40 text-on-surface shadow-md'
                        : 'bg-surface-container-low border-white/5 text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <div className="text-xs font-bold text-on-surface">{opt.label}</div>
                    <div className="text-[10px] text-on-surface-variant">{opt.sub}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dose Stepper & Direct Input */}
          <div className={`p-4 rounded-2xl bg-surface-container-low border ${themeBorder} text-center`}>
            <label className={`block text-xs font-semibold ${themeColor} uppercase tracking-wider mb-2`}>
              Units Taken Today (Adjustable)
            </label>
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => setUnits((u) => Math.max(1, u - 1))}
                className="w-11 h-11 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface flex items-center justify-center text-2xl font-bold shadow-inner"
              >
                -
              </button>
              <div className="flex items-baseline gap-1">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={units}
                  onChange={(e) => setUnits(Number(e.target.value))}
                  className={`w-20 text-center text-4xl font-extrabold ${themeColor} bg-transparent border-b border-white/20 focus:outline-none`}
                />
                <span className="text-sm font-semibold text-on-surface-variant">Units</span>
              </div>
              <button
                type="button"
                onClick={() => setUnits((u) => u + 1)}
                className="w-11 h-11 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface flex items-center justify-center text-2xl font-bold shadow-inner"
              >
                +
              </button>
            </div>
            {/* Quick Presets */}
            <div className="flex items-center justify-center gap-1.5 mt-3 flex-wrap">
              {[4, 8, 10, 15, 18, 20, 22, 25].map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnits(u)}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold transition-all ${
                    units === u
                      ? 'bg-primary text-on-primary font-bold'
                      : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {u}U
                </button>
              ))}
            </div>
          </div>

          {/* Time Selector */}
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
              Injection Time (IST)
            </label>
            <input
              type="time"
              value={logTime}
              onChange={(e) => setLogTime(e.target.value)}
              className="w-full px-4 py-2.5 bg-surface-container-low border border-white/10 rounded-xl text-sm font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          {/* Administration Status */}
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
              Administration Status
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTaken(true)}
                className={`py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  taken
                    ? 'bg-primary-container text-on-primary shadow-md'
                    : 'bg-surface-container-low text-on-surface-variant border border-white/5'
                }`}
              >
                <span className="material-symbols-outlined text-base">check</span>
                <span>Taken as Planned</span>
              </button>
              <button
                type="button"
                onClick={() => setTaken(false)}
                className={`py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  !taken
                    ? 'bg-error-container text-on-error-container shadow-md'
                    : 'bg-surface-container-low text-on-surface-variant border border-white/5'
                }`}
              >
                <span className="material-symbols-outlined text-base">close</span>
                <span>Delayed / Skipped</span>
              </button>
            </div>
          </div>

          {/* Note Input */}
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
              Site / Body Condition Note (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Higher dose due to heavy rice meal, lower abdomen"
              className="w-full px-4 py-2.5 bg-surface-container-low border border-white/10 rounded-xl text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary"
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
              className="flex-[2] py-3 rounded-full bg-primary-container text-on-primary font-bold text-xs sm:text-sm shadow-lg hover:bg-primary transition-all active:scale-95 cursor-pointer"
            >
              {initialData ? 'Update Dose Record' : 'Confirm Dose Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
