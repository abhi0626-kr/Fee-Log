/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useRef, useState, useEffect } from 'react';
import { MealType, CarbSize, FoodLog, COMMON_FOOD_CHIPS } from '@/types';
import { getCurrentTimeIST, getDefaultMealTypeByHour, getCurrentHourIST } from '@/lib/date-utils';
import { saveFoodLog, getActiveUserId, getSettings, saveSettings } from '@/lib/sync-storage';
import { estimateNutrientsFromItems } from '@/lib/macro-calculator';

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

  // Macro fields
  const [carbsG, setCarbsG] = useState<number | ''>('');
  const [proteinG, setProteinG] = useState<number | ''>('');
  const [fiberG, setFiberG] = useState<number | ''>('');
  const [sodiumMg, setSodiumMg] = useState<number | ''>('');
  const [calories, setCalories] = useState<number | ''>('');
  const [isMacrosManuallyEdited, setIsMacrosManuallyEdited] = useState<boolean>(false);

  // AI Scanner state
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanMessage, setScanMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showKeyPrompt, setShowKeyPrompt] = useState<boolean>(false);
  const [tempApiKey, setTempApiKey] = useState<string>('');
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setScanMessage(null);
      setShowKeyPrompt(false);

      if (initialData) {
        setMeal(initialData.meal);
        setLogTime(initialData.log_time);
        setItems(initialData.items);
        setCarbSize(initialData.carb_size || 'medium');
        setNote(initialData.note || '');
        setPhotoPreview(initialData.photo_url || null);

        if (
          initialData.carbs_g != null ||
          initialData.protein_g != null ||
          initialData.fiber_g != null ||
          initialData.sodium_mg != null
        ) {
          setCarbsG(initialData.carbs_g ?? '');
          setProteinG(initialData.protein_g ?? '');
          setFiberG(initialData.fiber_g ?? '');
          setSodiumMg(initialData.sodium_mg ?? '');
          setCalories(initialData.calories ?? '');
          setIsMacrosManuallyEdited(true);
        } else {
          // Estimate for legacy logs
          const est = estimateNutrientsFromItems(initialData.items, initialData.carb_size || 'medium');
          setCarbsG(est.carbs_g);
          setProteinG(est.protein_g);
          setFiberG(est.fiber_g);
          setSodiumMg(est.sodium_mg);
          setCalories(est.calories);
          setIsMacrosManuallyEdited(false);
        }
      } else {
        const defaultMeal = getDefaultMealTypeByHour(getCurrentHourIST());
        setMeal(defaultMeal);
        setLogTime(getCurrentTimeIST());
        setItems('');
        setCarbSize('medium');
        setNote('');
        setPhotoPreview(null);

        const est = estimateNutrientsFromItems('', 'medium');
        setCarbsG(est.carbs_g);
        setProteinG(est.protein_g);
        setFiberG(est.fiber_g);
        setSodiumMg(est.sodium_mg);
        setCalories(est.calories);
        setIsMacrosManuallyEdited(false);
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

  // Auto-update nutrients if user hasn't explicitly customized them
  const updateNutrientEstimates = (newItems: string, newCarbSize: CarbSize) => {
    if (!isMacrosManuallyEdited) {
      const est = estimateNutrientsFromItems(newItems, newCarbSize);
      setCarbsG(est.carbs_g);
      setProteinG(est.protein_g);
      setFiberG(est.fiber_g);
      setSodiumMg(est.sodium_mg);
      setCalories(est.calories);
    }
  };

  const handleChipClick = (chip: string) => {
    setItems((prev) => {
      const trimmed = prev.trim();
      let nextItems = '';
      if (!trimmed) {
        nextItems = chip;
      } else if (trimmed.toLowerCase().includes(chip.toLowerCase())) {
        nextItems = prev;
      } else {
        nextItems = `${trimmed}, ${chip}`;
      }
      updateNutrientEstimates(nextItems, carbSize);
      return nextItems;
    });
  };

  const handleItemsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    setItems(nextVal);
    updateNutrientEstimates(nextVal, carbSize);
  };

  const handleCarbSizeChange = (newSize: CarbSize) => {
    setCarbSize(newSize);
    updateNutrientEstimates(items, newSize);
  };

  const handleForceRecalculate = () => {
    const est = estimateNutrientsFromItems(items, carbSize);
    setCarbsG(est.carbs_g);
    setProteinG(est.protein_g);
    setFiberG(est.fiber_g);
    setSodiumMg(est.sodium_mg);
    setCalories(est.calories);
    setIsMacrosManuallyEdited(false);
  };

  // Client-side image compression to prevent exceeding localStorage quota (~5MB) or Supabase payload limit
  const compressImage = (file: File, maxDim = 800, quality = 0.75): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read selected image'));
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => reject(new Error('Failed to load image preview'));
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedUrl = await compressImage(file, 800, 0.75);
        setPhotoPreview(compressedUrl);
        setScanMessage(null);
      } catch (err) {
        console.warn('Image compression fallback:', err);
        const reader = new FileReader();
        reader.onloadend = () => {
          setPhotoPreview(reader.result as string);
          setScanMessage(null);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  // AI Plate Scanner Trigger
  const handleScanPlate = async (forceDemo: boolean = false, keyOverride?: string) => {
    if (!photoPreview && !forceDemo) return;

    setIsScanning(true);
    setScanMessage(null);

    try {
      const currentSettings = getSettings();
      const apiKey = keyOverride || currentSettings.gemini_api_key;

      const response = await fetch('/api/analyze-food-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: photoPreview,
          apiKey,
          mealHint: meal,
          isDemo: forceDemo,
        }),
      });

      const json = await response.json();

      if (!response.ok || !json.success) {
        if (json.error === 'NO_API_KEY') {
          setShowKeyPrompt(true);
          setScanMessage({
            text: 'Google Gemini API key required to scan plate.',
            type: 'info',
          });
        } else {
          setScanMessage({
            text: json.message || 'Failed to analyze food plate.',
            type: 'error',
          });
        }
        setIsScanning(false);
        return;
      }

      // Success: populate fields with AI findings!
      const data = json.data;
      setItems(data.items);
      setCarbSize(data.carb_size);
      setCarbsG(data.carbs_g);
      setProteinG(data.protein_g);
      setFiberG(data.fiber_g);
      setSodiumMg(data.sodium_mg);
      setCalories(data.calories);
      setIsMacrosManuallyEdited(true);
      setShowKeyPrompt(false);

      setScanMessage({
        text: data.explanation || 'Plate analyzed! Macros and food items auto-filled.',
        type: 'success',
      });
    } catch (err) {
      setScanMessage({
        text: (err as Error).message || 'Network error scanning plate.',
        type: 'error',
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleSaveApiKeyAndScan = () => {
    if (!tempApiKey.trim()) return;
    saveSettings({ gemini_api_key: tempApiKey.trim() });
    setShowKeyPrompt(false);
    handleScanPlate(false, tempApiKey.trim());
  };

  const handleStep = (
    field: 'carbs' | 'protein' | 'fiber' | 'sodium',
    delta: number
  ) => {
    setIsMacrosManuallyEdited(true);
    if (field === 'carbs') {
      const cur = Number(carbsG) || 0;
      const next = Math.max(0, Math.round((cur + delta) * 10) / 10);
      setCarbsG(next);
      setCalories(Math.round(next * 4 + (Number(proteinG) || 0) * 4));
    } else if (field === 'protein') {
      const cur = Number(proteinG) || 0;
      const next = Math.max(0, Math.round((cur + delta) * 10) / 10);
      setProteinG(next);
      setCalories(Math.round((Number(carbsG) || 0) * 4 + next * 4));
    } else if (field === 'fiber') {
      const cur = Number(fiberG) || 0;
      const next = Math.max(0, Math.round((cur + delta) * 10) / 10);
      setFiberG(next);
    } else if (field === 'sodium') {
      const cur = Number(sodiumMg) || 0;
      const next = Math.max(0, Math.round(cur + delta));
      setSodiumMg(next);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!items.trim()) {
      setScanMessage({
        text: 'Please enter food items (or pick from the quick chips above) to save.',
        type: 'error',
      });
      return;
    }

    try {
      saveFoodLog({
        id: initialData?.id,
        user_id: initialData?.user_id || getActiveUserId(),
        log_date: dateStr,
        log_time: logTime,
        meal,
        items: items.trim(),
        carb_size: carbSize,
        photo_url: photoPreview,
        carbs_g: carbsG === '' ? null : Number(carbsG),
        protein_g: proteinG === '' ? null : Number(proteinG),
        fiber_g: fiberG === '' ? null : Number(fiberG),
        sodium_mg: sodiumMg === '' ? null : Number(sodiumMg),
        calories: calories === '' ? null : Number(calories),
        note: note.trim() || null,
      });

      onSaved();
      onClose();
    } catch (err) {
      setScanMessage({
        text: `Error saving meal: ${(err as Error).message}`,
        type: 'error',
      });
    }
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

  const currentCarbsNum = Number(carbsG) || 0;
  const currentFiberNum = Number(fiberG) || 0;
  const netCarbs = Math.max(0, Math.round((currentCarbsNum - currentFiberNum) * 10) / 10);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative bg-surface-container/95 border border-white/10 text-on-surface w-full max-w-lg rounded-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 sm:px-6 py-4 border-b border-surface-container-high bg-surface-container/95 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-tertiary-container/20 text-tertiary border border-tertiary/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">restaurant</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-on-surface">
                {initialData ? 'Edit Food Log' : 'Log Food & Macros'}
              </h2>
              <p className="text-xs text-on-surface-variant">AI plate photo scanner &amp; fitness macros</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close food entry"
            className="w-9 h-9 rounded-full flex items-center justify-center bg-surface-container-high hover:bg-surface-bright text-on-surface-variant hover:text-on-surface transition-colors border border-white/10 cursor-pointer"
            title="Close"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
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

          {/* MEAL PHOTO & AI PLATE AUTO-SCANNER */}
          <div className="p-3.5 rounded-2xl bg-surface-container-low/90 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-tertiary text-base">add_a_photo</span>
                <span>Meal Photo &amp; AI Plate Scanner</span>
              </label>
              {photoPreview && (
                <button
                  type="button"
                  onClick={() => handleScanPlate(false)}
                  disabled={isScanning}
                  className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-black font-bold text-xs rounded-full shadow-lg transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <span className={`material-symbols-outlined text-sm ${isScanning ? 'animate-spin' : ''}`}>
                    {isScanning ? 'sync' : 'auto_awesome'}
                  </span>
                  <span>{isScanning ? 'Analyzing...' : 'AI Scan Plate'}</span>
                </button>
              )}
            </div>

            {photoPreview ? (
              <div className="relative w-full h-44 rounded-2xl overflow-hidden border border-white/15 bg-black/40 group">
                <img src={photoPreview} alt="Meal preview" className="w-full h-full object-cover" />

                {/* Laser scan effect during AI analysis */}
                {isScanning && (
                  <div className="absolute inset-0 bg-primary/20 backdrop-blur-[1px] flex flex-col items-center justify-center gap-2">
                    <div className="w-full h-1 bg-cyan-400 shadow-[0_0_15px_#22d3ee] animate-pulse" />
                    <span className="px-3 py-1 rounded-full bg-black/80 text-cyan-300 text-xs font-bold border border-cyan-400/40">
                      AI Scanning Plate &amp; Estimating Macros...
                    </span>
                  </div>
                )}

                <div className="absolute top-2 right-2 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPhotoPreview(null)}
                    disabled={isScanning}
                    className="px-2.5 py-1 bg-black/75 hover:bg-black/90 text-white rounded-full text-xs font-bold transition-colors cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-2 p-5 rounded-2xl bg-surface-container/60 border border-dashed border-white/15 hover:border-tertiary/50 text-on-surface-variant hover:text-on-surface cursor-pointer text-xs font-medium transition-all group"
                >
                  <div className="w-10 h-10 rounded-full bg-tertiary/10 text-tertiary border border-tertiary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-xl">camera_alt</span>
                  </div>
                  <div className="text-center">
                    <span className="font-bold text-on-surface block">Attach or Take Food Picture</span>
                    <span className="text-[11px] text-on-surface-variant">
                      AI auto-detects items, carbs, protein, fiber &amp; sodium
                    </span>
                  </div>
                </button>
                <input
                  ref={photoInputRef}
                  id="food-photo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="sr-only"
                />

                {/* Quick Demo Trigger for testing without a photo */}
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => handleScanPlate(true)}
                    className="text-[11px] text-tertiary/80 hover:text-tertiary font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <span className="material-symbols-outlined text-xs">play_circle</span>
                    <span>Try Demo AI Plate Scan</span>
                  </button>
                </div>
              </div>
            )}

            {/* Scan Message / Toast */}
            {scanMessage && (
              <div
                className={`p-2.5 rounded-xl text-xs flex items-center gap-2 border ${
                  scanMessage.type === 'success'
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : scanMessage.type === 'error'
                    ? 'bg-error/10 border-error/30 text-error'
                    : 'bg-surface-container-high border-white/10 text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-base shrink-0">
                  {scanMessage.type === 'success' ? 'check_circle' : scanMessage.type === 'error' ? 'error' : 'info'}
                </span>
                <span className="leading-tight">{scanMessage.text}</span>
              </div>
            )}

            {/* In-modal Gemini API Key prompt if not yet set */}
            {showKeyPrompt && (
              <div className="p-3 rounded-xl bg-surface-container border border-tertiary/30 space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between text-xs font-bold text-tertiary">
                  <span>Enter Free Gemini API Key</span>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-outline hover:text-on-surface underline"
                  >
                    Get Free Key ↗
                  </a>
                </div>
                <input
                  type="password"
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                  placeholder="Paste AIzaSy... key"
                  className="w-full px-3 py-1.5 rounded-lg bg-surface-container-high border border-white/10 text-xs text-on-surface font-mono focus:outline-none focus:ring-1 focus:ring-tertiary"
                />
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSaveApiKeyAndScan}
                    disabled={!tempApiKey.trim()}
                    className="flex-1 py-1.5 rounded-lg bg-primary-container text-on-primary font-bold text-xs hover:bg-primary transition-all disabled:opacity-50 cursor-pointer"
                  >
                    Save &amp; Scan Plate
                  </button>
                  <button
                    type="button"
                    onClick={() => handleScanPlate(true)}
                    className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface text-xs font-semibold cursor-pointer"
                  >
                    Try Demo Scan
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Items & Quick Chips */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                Food Items
              </label>
              <span className="text-[11px] text-tertiary">Quick add &amp; auto-estimate</span>
            </div>
            <input
              type="text"
              value={items}
              onChange={handleItemsChange}
              placeholder="e.g. 3 idly, sambar or 2 dosa with chutney"
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
                  onClick={() => handleCarbSizeChange(opt.id)}
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

          {/* FITNESS & NUTRITION MACRO CALCULATOR SECTION */}
          <div className="p-4 rounded-2xl bg-surface-container-low/90 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-secondary text-base">monitor_weight</span>
                <span className="text-xs font-bold text-on-surface uppercase tracking-wider">
                  Fitness Macros &amp; Nutrients
                </span>
              </div>
              <button
                type="button"
                onClick={handleForceRecalculate}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-tertiary bg-tertiary-container/20 hover:bg-tertiary-container/30 border border-tertiary/20 rounded-full transition-all active:scale-95 cursor-pointer"
                title="Recalculate nutrition from current food items and portion"
              >
                <span className="material-symbols-outlined text-xs">auto_awesome</span>
                <span>Auto-Estimate</span>
              </button>
            </div>

            {/* Live Net Carb & Calorie Banner */}
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-surface-container border border-white/5 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-on-surface-variant">Net Carbs:</span>
                <span className="font-bold text-primary px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                  {netCarbs}g
                </span>
                <span className="text-[10px] text-outline hidden sm:inline">(Total Carbs − Fiber)</span>
              </div>
              <div className="flex items-center gap-1.5 text-on-surface-variant">
                <span className="text-[11px]">Est. Energy:</span>
                <span className="font-bold text-on-surface">
                  {calories !== '' ? `${calories} kcal` : '—'}
                </span>
              </div>
            </div>

            {/* 4-Macro Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* Carbs */}
              <div className="p-2.5 rounded-xl bg-surface-container border border-white/5 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold text-primary">🍞 Carbs</span>
                  <span className="text-[10px] text-on-surface-variant">g</span>
                </div>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={carbsG}
                  onChange={(e) => {
                    setIsMacrosManuallyEdited(true);
                    setCarbsG(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)));
                  }}
                  className="w-full bg-surface-container-high px-2 py-1 rounded-lg text-sm font-bold text-on-surface text-center focus:outline-none focus:ring-1 focus:ring-primary mb-1.5"
                  placeholder="0"
                />
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => handleStep('carbs', -5)}
                    className="flex-1 py-0.5 rounded bg-surface-container-high hover:bg-surface-bright text-[10px] font-bold text-on-surface-variant text-center active:scale-95 cursor-pointer"
                  >
                    -5
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStep('carbs', 5)}
                    className="flex-1 py-0.5 rounded bg-surface-container-high hover:bg-surface-bright text-[10px] font-bold text-on-surface-variant text-center active:scale-95 cursor-pointer"
                  >
                    +5
                  </button>
                </div>
              </div>

              {/* Protein */}
              <div className="p-2.5 rounded-xl bg-surface-container border border-white/5 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold text-secondary">🍗 Protein</span>
                  <span className="text-[10px] text-on-surface-variant">g</span>
                </div>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={proteinG}
                  onChange={(e) => {
                    setIsMacrosManuallyEdited(true);
                    setProteinG(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)));
                  }}
                  className="w-full bg-surface-container-high px-2 py-1 rounded-lg text-sm font-bold text-on-surface text-center focus:outline-none focus:ring-1 focus:ring-secondary mb-1.5"
                  placeholder="0"
                />
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => handleStep('protein', -5)}
                    className="flex-1 py-0.5 rounded bg-surface-container-high hover:bg-surface-bright text-[10px] font-bold text-on-surface-variant text-center active:scale-95 cursor-pointer"
                  >
                    -5
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStep('protein', 5)}
                    className="flex-1 py-0.5 rounded bg-surface-container-high hover:bg-surface-bright text-[10px] font-bold text-on-surface-variant text-center active:scale-95 cursor-pointer"
                  >
                    +5
                  </button>
                </div>
              </div>

              {/* Fiber */}
              <div className="p-2.5 rounded-xl bg-surface-container border border-white/5 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold text-tertiary">🥗 Fiber</span>
                  <span className="text-[10px] text-on-surface-variant">g</span>
                </div>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={fiberG}
                  onChange={(e) => {
                    setIsMacrosManuallyEdited(true);
                    setFiberG(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)));
                  }}
                  className="w-full bg-surface-container-high px-2 py-1 rounded-lg text-sm font-bold text-on-surface text-center focus:outline-none focus:ring-1 focus:ring-tertiary mb-1.5"
                  placeholder="0"
                />
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => handleStep('fiber', -2)}
                    className="flex-1 py-0.5 rounded bg-surface-container-high hover:bg-surface-bright text-[10px] font-bold text-on-surface-variant text-center active:scale-95 cursor-pointer"
                  >
                    -2
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStep('fiber', 2)}
                    className="flex-1 py-0.5 rounded bg-surface-container-high hover:bg-surface-bright text-[10px] font-bold text-on-surface-variant text-center active:scale-95 cursor-pointer"
                  >
                    +2
                  </button>
                </div>
              </div>

              {/* Sodium */}
              <div className="p-2.5 rounded-xl bg-surface-container border border-white/5 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold text-amber-400">🧂 Sodium</span>
                  <span className="text-[10px] text-on-surface-variant">mg</span>
                </div>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={sodiumMg}
                  onChange={(e) => {
                    setIsMacrosManuallyEdited(true);
                    setSodiumMg(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)));
                  }}
                  className="w-full bg-surface-container-high px-2 py-1 rounded-lg text-sm font-bold text-on-surface text-center focus:outline-none focus:ring-1 focus:ring-amber-400 mb-1.5"
                  placeholder="0"
                />
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => handleStep('sodium', -100)}
                    className="flex-1 py-0.5 rounded bg-surface-container-high hover:bg-surface-bright text-[10px] font-bold text-on-surface-variant text-center active:scale-95 cursor-pointer"
                  >
                    -100
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStep('sodium', 100)}
                    className="flex-1 py-0.5 rounded bg-surface-container-high hover:bg-surface-bright text-[10px] font-bold text-on-surface-variant text-center active:scale-95 cursor-pointer"
                  >
                    +100
                  </button>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-on-surface-variant/80">
              💡 Calibrated for PG/South Indian meals. Helps with insulin timing, delayed protein absorption, and runner hydration.
            </p>
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
              {initialData ? 'Update Food & Macros' : 'Save Food & Macros'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
