'use client';

import React, { useState, useEffect } from 'react';
import { X, HeartPulse, Check } from 'lucide-react';
import { FeelLevel, FeelLog, FEEL_COLORS, SYMPTOM_OPTIONS } from '@/types';
import { getCurrentTimeIST } from '@/lib/date-utils';
import { saveFeelLog } from '@/lib/sync-storage';

interface FeelSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  dateStr: string;
  initialData?: FeelLog | null;
}

export default function FeelSheet({
  isOpen,
  onClose,
  onSaved,
  dateStr,
  initialData,
}: FeelSheetProps) {
  const [feel, setFeel] = useState<FeelLevel | null>('okay');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [logTime, setLogTime] = useState<string>(getCurrentTimeIST());
  const [note, setNote] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFeel(initialData.feel);
        setSelectedSymptoms(initialData.symptoms || []);
        setLogTime(initialData.log_time);
        setNote(initialData.note || '');
      } else {
        setFeel(null); // start unselected so user can pick in 1 tap
        setSelectedSymptoms([]);
        setLogTime(getCurrentTimeIST());
        setNote('');
      }
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSymptomToggle = (id: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleSave = (customFeel?: FeelLevel) => {
    const finalFeel = customFeel || feel;
    if (!finalFeel) return;

    saveFeelLog({
      id: initialData?.id,
      user_id: initialData?.user_id || 'user-1',
      log_date: dateStr,
      log_time: logTime,
      feel: finalFeel,
      symptoms: selectedSymptoms,
      note: note.trim() || null,
    });

    onSaved();
    onClose();
  };

  const feelButtons: { id: FeelLevel; label: string; sublabel: string; colorClass: string; activeClass: string }[] = [
    {
      id: 'low',
      label: 'Low',
      sublabel: 'Hypo feeling',
      colorClass: 'border-red-200 text-red-600 bg-red-50/50 hover:bg-red-100/70',
      activeClass: 'ring-3 ring-red-500 bg-red-600 text-white border-red-600',
    },
    {
      id: 'slightly_low',
      label: 'Slightly low',
      sublabel: 'Shaky / empty',
      colorClass: 'border-amber-200 text-amber-600 bg-amber-50/50 hover:bg-amber-100/70',
      activeClass: 'ring-3 ring-amber-500 bg-amber-500 text-white border-amber-500',
    },
    {
      id: 'okay',
      label: 'Okay',
      sublabel: 'Normal energy',
      colorClass: 'border-green-200 text-green-600 bg-green-50/50 hover:bg-green-100/70',
      activeClass: 'ring-3 ring-green-500 bg-green-600 text-white border-green-600',
    },
    {
      id: 'slightly_high',
      label: 'Slightly high',
      sublabel: 'Thirsty / heavy',
      colorClass: 'border-orange-200 text-orange-500 bg-orange-50/50 hover:bg-orange-100/70',
      activeClass: 'ring-3 ring-orange-400 bg-orange-400 text-white border-orange-400',
    },
    {
      id: 'high',
      label: 'High',
      sublabel: 'Hyper feeling',
      colorClass: 'border-orange-300 text-orange-700 bg-orange-100/50 hover:bg-orange-200/70',
      activeClass: 'ring-3 ring-orange-600 bg-orange-600 text-white border-orange-600',
    },
  ];

  const isHypo = feel === 'low' || feel === 'slightly_low';
  const isHyper = feel === 'high' || feel === 'slightly_high';
  const relevantSymptoms = isHypo
    ? SYMPTOM_OPTIONS.hypo
    : isHyper
    ? SYMPTOM_OPTIONS.hyper
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-6 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <HeartPulse className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                {initialData ? 'Edit Feel Log' : 'How Are You Feeling?'}
              </h2>
              <p className="text-xs text-slate-500">Subjective symptom log (≤2 taps to save)</p>
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Time Picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Log Time (IST)
            </label>
            <input
              type="time"
              value={logTime}
              onChange={(e) => setLogTime(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>

          {/* 5 Big Feel Buttons */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Select Feeling
            </label>
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
              {feelButtons.map((btn) => {
                const isSelected = feel === btn.id;
                return (
                  <button
                    key={btn.id}
                    type="button"
                    onClick={() => {
                      setFeel(btn.id);
                      if (btn.id === 'okay') {
                        // Quick 2-tap save if user feels okay
                        setSelectedSymptoms([]);
                      }
                    }}
                    className={`flex flex-col items-center justify-center py-3 px-1 rounded-xl border text-center transition-all min-h-[64px] active:scale-95 ${
                      isSelected ? btn.activeClass : btn.colorClass
                    }`}
                  >
                    <span className="text-xs font-bold leading-tight">{btn.label}</span>
                    <span
                      className={`text-[9px] mt-1 line-clamp-1 ${
                        isSelected ? 'text-white/90' : 'opacity-70'
                      }`}
                    >
                      {btn.sublabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Symptom Checkboxes (shown only if feel selected & not okay) */}
          {relevantSymptoms.length > 0 && (
            <div className="animate-in fade-in duration-200 p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                What symptoms are you experiencing?
              </label>
              <div className="grid grid-cols-2 gap-2">
                {relevantSymptoms.map((sym) => {
                  const isChecked = selectedSymptoms.includes(sym.id);
                  return (
                    <button
                      key={sym.id}
                      type="button"
                      onClick={() => handleSymptomToggle(sym.id)}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-medium transition-all text-left ${
                        isChecked
                          ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-semibold'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border ${
                          isChecked
                            ? 'bg-purple-600 border-purple-600 text-white'
                            : 'border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span className="truncate">{sym.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Note (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. In PG room study desk, felt heavy thirst"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Save Button */}
          <div className="pt-2">
            <button
              type="button"
              disabled={!feel}
              onClick={() => handleSave()}
              className="w-full py-3.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white font-bold rounded-xl shadow-md transition-all active:scale-[0.99] min-h-[48px]"
            >
              {initialData ? 'Update Feel Log' : feel ? `Save "${FEEL_COLORS[feel].label}" Log` : 'Select a Feeling Above'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
