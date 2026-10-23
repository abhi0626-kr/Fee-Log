/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useEffect } from 'react';
import { MealType, CarbSize, FoodLog, COMMON_FOOD_CHIPS } from '@/types';
import { getCurrentTimeIST, getDefaultMealTypeByHour, getCurrentHourIST } from '@/lib/date-utils';
import { saveFoodLog } from '@/lib/sync-storage';

interface FoodSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  dateStr: string;
  initialData?: FoodLog | null;
}

export default function FoodSheet({
  isOpen,
  onClose,
  onSaved,
  dateStr,
  initialData,
}: FoodSheetProps) {
  const [meal, setMeal] = useState<MealType>('lunch');
  const [logTime, setLogTime] = useState<string>(getCurrentTimeIST());
  const [items, setItems] = useState<string>('');
  const [carbSize, setCarbSize] = useState<CarbSize>('medium');
  const [note, setNote] = useState<string>('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setMeal(initialData.meal);
        setLogTime(initialData.log_time);
        setItems(initialData.items);
        setCarbSize(initialData.carb_size || 'medium');
        setNote(initialData.note || '');
        setPhotoPreview(initialData.photo_url || null);
      } else {
        const defaultMeal = getDefaultMealTypeByHour(getCurrentHourIST());
        setMeal(defaultMeal);
        setLogTime(getCurrentTimeIST());
        setItems('');
        setCarbSize('medium');
        setNote('');
        setPhotoPreview(null);
      }
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleChipClick = (chip: string) => {
    setItems((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return chip;
      if (trimmed.toLowerCase().includes(chip.toLowerCase())) return prev;
      return `${trimmed}, ${chip}`;
    });
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!items.trim()) return;

    saveFoodLog({
      id: initialData?.id,
      user_id: initialData?.user_id || 'user-1',
      log_date: dateStr,
      log_time: logTime,
      meal,
      items: items.trim(),
      carb_size: carbSize,
      photo_url: photoPreview,
      note: note.trim() || null,
    });

    onSaved();
    onClose();
  };

  const mealOptions: { id: MealType; label: string }[] = [
    { id: 'breakfast', label: 'Breakfast' },
    { id: 'lunch', label: 'Lunch' },
    { id: 'snack', label: 'Snack' },
    { id: 'dinner', label: 'Dinner' },
  ];

  const carbOptions: { id: CarbSize; label: string; desc: string }[] = [
    { id: 'small', label: 'Small', desc: '1–2 items / light' },
    { id: 'medium', label: 'Medium', desc: 'Standard PG meal' },
    { id: 'large', label: 'Large', desc: 'Heavier rice/dosa' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-md p-0 sm:p-4">
      <div className="bg-surface-container/95 border border-white/10 text-on-surface w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-6 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-container-high">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-tertiary-container/20 text-tertiary border border-tertiary/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">restaurant</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-on-surface">
                {initialData ? 'Edit Food Log' : 'Log Food & Meal'}
              </h2>
              <p className="text-xs text-on-surface-variant">Capture PG meal &amp; carb estimate</p>
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
          {/* Meal Type Segmented Selector */}
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
              Meal Type
            </label>
            <div className="grid grid-cols-4 gap-1.5 p-1 bg-surface-container-low rounded-2xl border border-white/5">
              {mealOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setMeal(opt.id)}
                  className={`py-2 text-xs font-bold rounded-xl transition-all ${
                    meal === opt.id
                      ? 'bg-primary-container text-on-primary shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time Selector */}
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
              Meal Time (IST)
            </label>
            <input
              type="time"
              value={logTime}
              onChange={(e) => setLogTime(e.target.value)}
              className="w-full px-4 py-2.5 bg-surface-container-low border border-white/10 rounded-xl text-sm font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          {/* Items & Quick Chips */}
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
              Food Items
            </label>
            <input
              type="text"
              value={items}
              onChange={(e) => setItems(e.target.value)}
              placeholder="e.g. 3 idly, sambar or rice with dal"
              className="w-full px-4 py-2.5 bg-surface-container-low border border-white/10 rounded-xl text-sm font-medium text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary mb-2.5"
              required
            />
            {/* Quick Chips */}
            <div className="flex flex-wrap gap-1.5">
              {COMMON_FOOD_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleChipClick(chip)}
                  className="px-3 py-1 text-xs font-medium bg-tertiary-container/15 border border-tertiary/20 text-tertiary rounded-full hover:bg-tertiary/25 transition-colors active:scale-95"
                >
                  + {chip}
                </button>
              ))}
            </div>
          </div>

          {/* Carb Size Segmented */}
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
              Carb Density Portion
            </label>
            <div className="grid grid-cols-3 gap-2">
              {carbOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setCarbSize(opt.id)}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    carbSize === opt.id
                      ? 'border-tertiary bg-tertiary-container/20 text-on-surface shadow-md'
                      : 'border-white/5 bg-surface-container-low text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <div className="text-xs font-bold text-on-surface">{opt.label}</div>
                  <div className="text-[10px] text-on-surface-variant mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Optional Photo Attachment */}
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
              Meal Photo (Optional)
            </label>
            {photoPreview ? (
              <div className="relative w-full h-32 rounded-2xl overflow-hidden border border-white/10 bg-surface-container-low">
                <img src={photoPreview} alt="Meal preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setPhotoPreview(null)}
                  className="absolute top-2 right-2 px-2.5 py-1 bg-black/70 text-white rounded-full text-xs font-bold"
                >
                  Remove
                </button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-surface-container-low border border-dashed border-white/10 text-on-surface-variant hover:text-on-surface cursor-pointer text-xs font-medium">
                <span className="material-symbols-outlined text-lg">add_a_photo</span>
                <span>Attach Quick Photo</span>
                <input type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
              </label>
            )}
          </div>

          {/* Note Input */}
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
              Notes (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. PG Mess spicy sambar, late dinner"
              className="w-full px-4 py-2.5 bg-surface-container-low border border-white/10 rounded-xl text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3 rounded-full bg-primary-container text-on-primary font-bold text-sm shadow-lg hover:bg-primary transition-all active:scale-95"
            >
              {initialData ? 'Update Food Log' : 'Save Food Log'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
