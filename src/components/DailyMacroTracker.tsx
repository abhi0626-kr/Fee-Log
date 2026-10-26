/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState } from 'react';
import { FoodLog, UserSettings } from '@/types';
import { calculateDailyMacroSummary } from '@/lib/macro-calculator';

interface DailyMacroTrackerProps {
  todayFoodLogs: FoodLog[];
  settings: UserSettings;
  onOpenFoodSheet: () => void;
  onEditFoodLog?: (food: FoodLog) => void;
}

export default function DailyMacroTracker({
  todayFoodLogs,
  settings,
  onOpenFoodSheet,
  onEditFoodLog,
}: DailyMacroTrackerProps) {
  const [showMealList, setShowMealList] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  const summary = calculateDailyMacroSummary(todayFoodLogs, settings);

  // Dynamic context insight for T1D & Fitness
  let insightText = '';
  let insightIcon = 'lightbulb';
  let insightTone = 'text-tertiary';

  if (summary.mealCount === 0) {
    insightText = 'No meals logged yet today. Tap + Food to record your breakfast, lunch, or snack.';
    insightIcon = 'restaurant';
    insightTone = 'text-on-surface-variant';
  } else if (summary.totalSodium > summary.maxSodium) {
    insightText = `Sodium is elevated (${summary.totalSodium.toLocaleString()}mg / ${summary.maxSodium}mg limit). Drink plenty of water and hydrate for running.`;
    insightIcon = 'warning';
    insightTone = 'text-amber-400';
  } else if (summary.totalFiber >= 20) {
    insightText = `Great fiber intake (${summary.totalFiber}g). Fiber buffers carb absorption and softens post-meal glucose spikes.`;
    insightIcon = 'verified';
    insightTone = 'text-secondary';
  } else if (summary.totalProtein >= 65) {
    insightText = `Solid protein intake (${summary.totalProtein}g) supports muscle recovery. Note that protein may cause a mild, delayed glucose rise.`;
    insightIcon = 'fitness_center';
    insightTone = 'text-primary';
  } else {
    insightText = `Net Carbs: ${summary.netCarbs}g (${summary.totalCarbs}g total - ${summary.totalFiber}g fiber). Use this to align your insulin bolus.`;
    insightIcon = 'pie_chart';
    insightTone = 'text-tertiary';
  }

  return (
    <section className="p-4 sm:p-5 rounded-3xl bg-surface-container-low/90 border border-white/5 backdrop-blur-md shadow-xl transition-all">
      {/* Tracker Header */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-tertiary/15 text-tertiary border border-tertiary/20 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              analytics
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-on-surface">Today&apos;s Fuel &amp; Macro Tracker</h2>
              <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-[10px] font-bold text-on-surface-variant border border-white/5">
                Fitness Tracker
              </span>
            </div>
            <p className="text-xs text-on-surface-variant">Carbs, protein, fiber &amp; sodium calculator</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {summary.mealCount > 0 && (
            <button
              type="button"
              onClick={() => setShowMealList(!showMealList)}
              className="px-3 py-1.5 rounded-full bg-surface-container-high hover:bg-surface-bright text-xs font-semibold text-on-surface transition-all border border-white/10 active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">
                {showMealList ? 'expand_less' : 'expand_more'}
              </span>
              <span>{summary.mealCount} {summary.mealCount === 1 ? 'Meal' : 'Meals'} ({summary.totalCalories} kcal)</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenFoodSheet}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary-container text-on-primary hover:bg-primary font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            <span>+ Meal</span>
          </button>
        </div>
      </div>

      {/* 4-Column Fitness Macro Gauges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3.5 mb-3.5">
        {/* 1. Total & Net Carbs */}
        <div className="p-3.5 rounded-2xl bg-surface-container/70 border border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-primary flex items-center gap-1">
              <span>🍞</span> Carbs
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
              {summary.carbPercent}%
            </span>
          </div>

          <div className="mb-2">
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-black text-on-surface">{summary.totalCarbs}</span>
              <span className="text-xs text-on-surface-variant font-semibold">/ {summary.targetCarbs}g</span>
            </div>
            <div className="text-[11px] text-tertiary font-semibold mt-0.5">
              Net: <span className="font-bold">{summary.netCarbs}g</span>
            </div>
          </div>

          <div className="w-full h-2 rounded-full bg-surface-container-high overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-teal-400 to-cyan-400 transition-all duration-500"
              style={{ width: `${Math.min(100, summary.carbPercent)}%` }}
            />
          </div>
        </div>

        {/* 2. Protein */}
        <div className="p-3.5 rounded-2xl bg-surface-container/70 border border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-secondary flex items-center gap-1">
              <span>🍗</span> Protein
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-secondary/10 text-secondary">
              {summary.proteinPercent}%
            </span>
          </div>

          <div className="mb-2">
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-black text-on-surface">{summary.totalProtein}</span>
              <span className="text-xs text-on-surface-variant font-semibold">/ {summary.targetProtein}g</span>
            </div>
            <div className="text-[11px] text-on-surface-variant truncate mt-0.5">
              Muscle recovery
            </div>
          </div>

          <div className="w-full h-2 rounded-full bg-surface-container-high overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-green-500 transition-all duration-500"
              style={{ width: `${Math.min(100, summary.proteinPercent)}%` }}
            />
          </div>
        </div>

        {/* 3. Fiber */}
        <div className="p-3.5 rounded-2xl bg-surface-container/70 border border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-tertiary flex items-center gap-1">
              <span>🥗</span> Fiber
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-tertiary/10 text-tertiary">
              {summary.fiberPercent}%
            </span>
          </div>

          <div className="mb-2">
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-black text-on-surface">{summary.totalFiber}</span>
              <span className="text-xs text-on-surface-variant font-semibold">/ {summary.targetFiber}g</span>
            </div>
            <div className="text-[11px] text-tertiary truncate mt-0.5">
              Spike buffer
            </div>
          </div>

          <div className="w-full h-2 rounded-full bg-surface-container-high overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-300 to-orange-400 transition-all duration-500"
              style={{ width: `${Math.min(100, summary.fiberPercent)}%` }}
            />
          </div>
        </div>

        {/* 4. Sodium */}
        <div className="p-3.5 rounded-2xl bg-surface-container/70 border border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
              <span>🧂</span> Sodium
            </span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                summary.totalSodium > summary.maxSodium
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-amber-400/10 text-amber-400'
              }`}
            >
              {summary.sodiumPercent}%
            </span>
          </div>

          <div className="mb-2">
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-black text-on-surface">
                {summary.totalSodium.toLocaleString()}
              </span>
              <span className="text-xs text-on-surface-variant font-semibold">/ {summary.maxSodium}mg</span>
            </div>
            <div className="text-[11px] text-on-surface-variant truncate mt-0.5">
              {summary.totalSodium > summary.maxSodium ? 'Over daily limit' : 'Hydration & renal'}
            </div>
          </div>

          <div className="w-full h-2 rounded-full bg-surface-container-high overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                summary.totalSodium > summary.maxSodium
                  ? 'bg-red-500'
                  : 'bg-gradient-to-r from-amber-400 to-orange-500'
              }`}
              style={{ width: `${Math.min(100, summary.sodiumPercent)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Fitness / Diabetic Insight Banner */}
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-surface-container border border-white/5 text-xs text-on-surface-variant">
        <span className={`material-symbols-outlined text-base shrink-0 ${insightTone}`}>
          {insightIcon}
        </span>
        <span className="leading-snug">{insightText}</span>
      </div>

      {/* Collapsible Meal Breakdown */}
      {showMealList && todayFoodLogs.length > 0 && (
        <div className="mt-3.5 pt-3.5 border-t border-white/5 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-on-surface-variant px-1 mb-1">
            <span>TODAY&apos;S LOGGED MEALS</span>
            <span>Tap to edit macros</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {todayFoodLogs.map((log) => {
              const carbs = log.carbs_g ?? 0;
              const protein = log.protein_g ?? 0;
              const fiber = log.fiber_g ?? 0;
              const sodium = log.sodium_mg ?? 0;
              const cals = log.calories ?? Math.round(carbs * 4 + protein * 4);

              return (
                <div
                  key={log.id}
                  onClick={() => onEditFoodLog?.(log)}
                  className="p-3 rounded-2xl bg-surface-container hover:bg-surface-container-high border border-white/5 flex items-center justify-between gap-3 cursor-pointer transition-all active:scale-98 group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {log.photo_url ? (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewPhoto(log.photo_url || null);
                        }}
                        className="w-10 h-10 rounded-xl overflow-hidden border border-white/10 shrink-0 relative hover:opacity-80"
                        title="Click to view full photo"
                      >
                        <img src={log.photo_url} alt={log.items} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-tertiary/10 text-tertiary border border-tertiary/20 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-base">restaurant</span>
                      </div>
                    )}
                    <div className="min-w-0 truncate">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-on-surface capitalize">{log.meal}</span>
                        <span className="text-[10px] text-on-surface-variant">{log.log_time}</span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant truncate">{log.items}</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs font-bold text-primary">{carbs}g C ({cals} kcal)</div>
                    <div className="text-[10px] text-on-surface-variant">
                      {protein}g P · {fiber}g F · {sodium}mg Na
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Full Photo Modal Preview */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setPreviewPhoto(null)}
        >
          <div className="relative max-w-md w-full rounded-2xl overflow-hidden border border-white/20 shadow-2xl">
            <img src={previewPhoto} alt="Meal Full Preview" className="w-full max-h-[80vh] object-contain" />
            <button
              type="button"
              onClick={() => setPreviewPhoto(null)}
              className="absolute top-3 right-3 px-3 py-1 bg-black/80 text-white rounded-full text-xs font-bold"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
