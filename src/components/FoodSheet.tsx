'use client';

import React, { useState, useEffect } from 'react';
import { X, Utensils, Camera, Plus } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-6 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                {initialData ? 'Edit Food Log' : 'Log Food & Meal'}
              </h2>
              <p className="text-xs text-slate-500">Quickly capture meal & carb level</p>
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
          {/* Meal Type Segmented Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Meal Type
            </label>
            <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              {mealOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setMeal(opt.id)}
                  className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                    meal === opt.id
                      ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Meal Time (IST)
            </label>
            <input
              type="time"
              value={logTime}
              onChange={(e) => setLogTime(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
              required
            />
          </div>

          {/* Items & Quick Chips */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Food Items
            </label>
            <input
              type="text"
              value={items}
              onChange={(e) => setItems(e.target.value)}
              placeholder="e.g. 3 idly, sambar or rice with dal"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 mb-2"
              required
            />
            {/* Quick Chips */}
            <div className="flex flex-wrap gap-1.5">
              {COMMON_FOOD_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleChipClick(chip)}
                  className="px-2.5 py-1 text-xs font-medium bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/50 text-amber-800 dark:text-amber-300 rounded-full hover:bg-amber-100 transition-colors flex items-center gap-1 active:scale-95"
                >
                  <Plus className="w-3 h-3 opacity-60" />
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* Carb Size Segmented */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Carb Portion Size
            </label>
            <div className="grid grid-cols-3 gap-2">
              {carbOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setCarbSize(opt.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    carbSize === opt.id
                      ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 ring-2 ring-amber-400/30'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <div className="text-xs font-bold">{opt.label}</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
                    {opt.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Photo upload (optional) */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Meal Photo (Optional)
            </label>
            {photoPreview ? (
              <div className="relative w-full h-32 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 mb-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoPreview}
                  alt="Meal preview"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setPhotoPreview(null)}
                  className="absolute top-2 right-2 bg-black/70 text-white rounded-full p-1 hover:bg-black"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 w-full py-2.5 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-xs text-slate-600 dark:text-slate-400 font-medium">
                <Camera className="w-4 h-4 text-slate-500" />
                <span>Snap or attach photo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
              </label>
            )}
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
              placeholder="e.g. PG mess food was extra oily or skipped second round"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={!items.trim()}
              className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition-all active:scale-[0.99] min-h-[48px]"
            >
              {initialData ? 'Update Food Log' : 'Save Food Log'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
