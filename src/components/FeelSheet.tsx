'use client';

import React, { useState, useEffect } from 'react';
import { FeelLevel, FeelLog } from '@/types';
import { getCurrentTimeIST } from '@/lib/date-utils';
import { saveFeelLog } from '@/lib/sync-storage';

interface FeelSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  dateStr: string;
  initialData?: FeelLog | null;
}

const FEEL_OPTIONS: {
  id: FeelLevel;
  emoji: string;
  label: string;
  desc: string;
  chips: string[];
}[] = [
  {
    id: 'low',
    emoji: '📉',
    label: 'Low',
    desc: 'Under ~70 mg/dL feeling',
    chips: ['Shaky', 'Cold Sweats', 'Dizziness', 'Sudden Hunger', 'Brain Fog', 'Fast Pulse'],
  },
  {
    id: 'slightly_low',
    emoji: '🔻',
    label: 'Slightly low',
    desc: 'Dipping early signs',
    chips: ['Mild Tremor', 'Yawning', 'Heavy Legs', 'Anxious Sensation', 'Light Sweating'],
  },
  {
    id: 'okay',
    emoji: '✨',
    label: 'Okay',
    desc: 'Balanced & In-Range',
    chips: ['High Energy', 'Clear Head', 'Good Focus', 'Calm Pulse', 'Post-Run Endorphins'],
  },
  {
    id: 'slightly_high',
    emoji: '☕',
    label: 'Slightly high',
    desc: 'Post-meal elevation',
    chips: ['Sluggish', 'Mild Thirst', 'Heavy Eyes', 'PG Mess Rice Aftermath', 'Restless', 'Headache'],
  },
  {
    id: 'high',
    emoji: '🔥',
    label: 'High',
    desc: 'Significant spike',
    chips: ['Extreme Thirst', 'Dry Mouth', 'Very Heavy Eyes', 'Brain Fog', 'Frequent Urination', 'Fatigue'],
  },
];

export default function FeelSheet({
  isOpen,
  onClose,
  onSaved,
  dateStr,
  initialData,
}: FeelSheetProps) {
  const [feel, setFeel] = useState<FeelLevel>('okay');
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
        setFeel('okay');
        setSelectedSymptoms(['High Energy', 'Clear Head']);
        setLogTime(getCurrentTimeIST());
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

  const handleSymptomToggle = (symptom: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(symptom) ? prev.filter((s) => s !== symptom) : [...prev, symptom]
    );
  };

  const handleFeelChange = (lvl: FeelLevel) => {
    setFeel(lvl);
    const opt = FEEL_OPTIONS.find((o) => o.id === lvl);
    if (opt) {
      setSelectedSymptoms(opt.chips.slice(0, 2));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    saveFeelLog({
      id: initialData?.id,
      user_id: initialData?.user_id || 'user-1',
      log_date: dateStr,
      log_time: logTime,
      feel,
      symptoms: selectedSymptoms,
      note: note.trim() || null,
    });

    onSaved();
    onClose();
  };

  const currentOption = FEEL_OPTIONS.find((o) => o.id === feel) || FEEL_OPTIONS[2];

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
            <div className="w-10 h-10 rounded-full bg-primary/20 text-primary border border-primary/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">vital_signs</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-on-surface">
                {initialData ? 'Edit Feel Check-in' : 'Record Sensory Feel'}
              </h2>
              <p className="text-xs text-on-surface-variant">5-second somatic feedback</p>
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
          {/* Time Selector */}
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
              Time of Check-in (IST)
            </label>
            <input
              type="time"
              value={logTime}
              onChange={(e) => setLogTime(e.target.value)}
              className="w-full px-4 py-2.5 bg-surface-container-low border border-white/10 rounded-xl text-sm font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          {/* 5 Feel Buttons */}
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
              How does your body feel?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
              {FEEL_OPTIONS.map((opt) => {
                const isActive = feel === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleFeelChange(opt.id)}
                    className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1 ${
                      isActive
                        ? 'border-tertiary bg-tertiary-container/20 text-on-surface shadow-md font-bold'
                        : 'border-white/5 bg-surface-container-low text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <span className="text-xl">{opt.emoji}</span>
                    <span className="text-xs font-bold leading-tight">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Symptoms chips */}
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
              Symptoms / Bodily Cues ({currentOption.label})
            </label>
            <div className="flex flex-wrap gap-2">
              {currentOption.chips.map((symptom) => {
                const isSelected = selectedSymptoms.includes(symptom);
                return (
                  <button
                    key={symptom}
                    type="button"
                    onClick={() => handleSymptomToggle(symptom)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-tertiary/20 text-tertiary border border-tertiary/30 font-bold'
                        : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface border border-white/5'
                    }`}
                  >
                    {isSelected ? `✓ ${symptom}` : `+ ${symptom}`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
              Notes (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Post-lunch rice, during exam"
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
              {initialData ? 'Update Feel Check-in' : 'Save Feel Check-in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
