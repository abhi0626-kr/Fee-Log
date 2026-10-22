'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Info,
  ChevronRight,
  X,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  computeRule1HighAfterLunch,
  computeRule2LowSkippedDelayedLunch,
  computeRule3CarbSizeComparison,
  computeRule4MealItemFlag,
  computeRule5RunVsNoRunDistribution,
  computeRule6FeelVsGlucoseCalibration,
  RuleResult,
  Rule1Data,
  Rule2Data,
  Rule3Data,
  Rule4Data,
  Rule5Data,
  Rule6Data,
} from '@/lib/patterns';
import {
  getFeelLogs,
  getFoodLogs,
  getActivityLogs,
  getGlucoseLogs,
} from '@/lib/sync-storage';
import { MEDICAL_DISCLAIMER } from '@/types';

export default function PatternsPage() {
  const [windowDays, setWindowDays] = useState<number>(14);
  const [selectedEntryList, setSelectedEntryList] = useState<{
    title: string;
    entries: { date: string; description: string }[];
  } | null>(null);

  const [rule1, setRule1] = useState<RuleResult<Rule1Data> | null>(null);
  const [rule2, setRule2] = useState<RuleResult<Rule2Data> | null>(null);
  const [rule3, setRule3] = useState<RuleResult<Rule3Data> | null>(null);
  const [rule4, setRule4] = useState<RuleResult<Rule4Data> | null>(null);
  const [rule5, setRule5] = useState<RuleResult<Rule5Data> | null>(null);
  const [rule6, setRule6] = useState<RuleResult<Rule6Data> | null>(null);

  const loadData = useCallback(() => {
    const feels = getFeelLogs();
    const foods = getFoodLogs();
    const activities = getActivityLogs();
    const glucoses = getGlucoseLogs();

    setRule1(computeRule1HighAfterLunch(feels, foods, windowDays));
    setRule2(computeRule2LowSkippedDelayedLunch(feels, foods, windowDays));
    setRule3(computeRule3CarbSizeComparison(feels, foods, windowDays));
    setRule4(computeRule4MealItemFlag(feels, foods, windowDays));
    setRule5(computeRule5RunVsNoRunDistribution(feels, activities, windowDays));
    setRule6(computeRule6FeelVsGlucoseCalibration(feels, glucoses, windowDays));
  }, [windowDays]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const windowOptions = [
    { label: '7 Days', val: 7 },
    { label: '14 Days', val: 14 },
    { label: '30 Days', val: 30 },
  ];

  return (
    <div className="pb-28 max-w-lg mx-auto px-4 pt-4">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
          <Sparkles className="w-4 h-4" />
          <span>Pattern Finder</span>
        </div>
        <h1 className="text-xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
          Logged Insights & Patterns
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Deterministic correlation engine over your personal logs
        </p>
      </div>

      {/* Persistent Disclaimer Banner */}
      <div className="p-3.5 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/90 dark:border-amber-900/60 rounded-2xl mb-5 flex items-start gap-2.5 shadow-xs">
        <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <p className="text-[11px] leading-relaxed text-amber-900 dark:text-amber-200 font-medium">
          {MEDICAL_DISCLAIMER}
        </p>
      </div>

      {/* Date Window Segmented Selector */}
      <div className="flex items-center justify-between mb-5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
        {windowOptions.map((opt) => (
          <button
            key={opt.val}
            type="button"
            onClick={() => setWindowDays(opt.val)}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
              windowDays === opt.val
                ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-300 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Cards Container */}
      <div className="space-y-4">
        {/* RULE 1: High-After-Lunch Frequency */}
        {rule1 && (
          <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">
                Pattern 1 · Lunch & Afternoon Highs
              </span>
              <span className="text-[10px] text-slate-400">14:00–19:00</span>
            </div>

            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1.5 leading-snug">
              {rule1.sentence}
            </h3>

            {rule1.hasEnoughData ? (
              <div>
                <div className="h-28 w-full mt-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { name: 'High Days', count: rule1.data.highFeelDaysCount, fill: '#ea580c' },
                        {
                          name: 'Other Lunch Days',
                          count: rule1.data.totalDaysWithLunch - rule1.data.highFeelDaysCount,
                          fill: '#16a34a',
                        },
                      ]}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedEntryList({
                        title: rule1.title,
                        entries: rule1.supportingEntries || [],
                      })
                    }
                    className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                  >
                    View matching entries ({rule1.supportingEntries?.length || 0})
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 mt-2">
                Need at least 3 lunch logs in this window to detect pattern.
              </p>
            )}
            <p className="text-[10px] text-slate-400 italic mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60">
              {rule1.disclaimer}
            </p>
          </div>
        )}

        {/* RULE 2: Low on Skipped / Delayed Lunch */}
        {rule2 && (
          <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">
                Pattern 2 · Skipped / Late Lunch Lows
              </span>
              <span className="text-[10px] text-slate-400">Post-2pm or Missed</span>
            </div>

            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1.5 leading-snug">
              {rule2.sentence}
            </h3>

            {rule2.hasEnoughData ? (
              <div>
                <div className="h-28 w-full mt-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { name: 'Low Feels Logged', count: rule2.data.lowFeelDaysCount, fill: '#dc2626' },
                        {
                          name: 'Other Late Days',
                          count: Math.max(0, rule2.data.skippedOrDelayedLunchDays - rule2.data.lowFeelDaysCount),
                          fill: '#f59e0b',
                        },
                      ]}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedEntryList({
                        title: rule2.title,
                        entries: rule2.supportingEntries || [],
                      })
                    }
                    className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                  >
                    View low incident entries ({rule2.supportingEntries?.length || 0})
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 mt-2">
                Need more entries to analyze delayed or skipped meal correlation.
              </p>
            )}
            <p className="text-[10px] text-slate-400 italic mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60">
              {rule2.disclaimer}
            </p>
          </div>
        )}

        {/* RULE 3: Carb-size comparison */}
        {rule3 && (
          <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                Pattern 3 · Carb Size Impact
              </span>
              <span className="text-[10px] text-slate-400">Small vs Med vs Large</span>
            </div>

            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1.5 leading-snug">
              {rule3.sentence}
            </h3>

            {rule3.hasEnoughData ? (
              <div>
                <div className="h-32 w-full mt-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={rule3.data.counts.map((c) => ({
                        name: c.carbSize.charAt(0).toUpperCase() + c.carbSize.slice(1),
                        highs: c.highCount,
                        total: c.totalCount,
                      }))}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="highs" name="High Feels" fill="#ea580c" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedEntryList({
                        title: rule3.title,
                        entries: rule3.supportingEntries || [],
                      })
                    }
                    className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                  >
                    View entries by carb size ({rule3.supportingEntries?.length || 0})
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 mt-2">
                Need at least 3 afternoon feel logs to compare carb portions.
              </p>
            )}
            <p className="text-[10px] text-slate-400 italic mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60">
              {rule3.disclaimer}
            </p>
          </div>
        )}

        {/* RULE 4: Meal-item flag (Bangalore PG Staples) */}
        {rule4 && (
          <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider">
                Pattern 4 · South Indian PG Lunch Staples
              </span>
              <span className="text-[10px] text-slate-400">Keyword Scan</span>
            </div>

            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1.5 leading-snug">
              {rule4.sentence}
            </h3>

            {rule4.hasEnoughData ? (
              <div>
                <div className="h-32 w-full mt-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={rule4.data.keywordCounts.map((k) => ({
                        item: k.keyword.charAt(0).toUpperCase() + k.keyword.slice(1),
                        count: k.count,
                      }))}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <XAxis dataKey="item" tick={{ fontSize: 10 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="count" name="High Feel Days" fill="#0d9488" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedEntryList({
                        title: rule4.title,
                        entries: rule4.supportingEntries || [],
                      })
                    }
                    className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                  >
                    View high meal logs ({rule4.supportingEntries?.length || 0})
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 mt-2">
                Need at least 3 high afternoon feel logs to scan food staple keywords.
              </p>
            )}
            <p className="text-[10px] text-slate-400 italic mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60">
              {rule4.disclaimer}
            </p>
          </div>
        )}

        {/* RULE 5: Run-Day vs No-Run-Day Feel Distribution */}
        {rule5 && (
          <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                Pattern 5 · Running Activity Impact
              </span>
              <span className="text-[10px] text-slate-400">5–10 km Runs</span>
            </div>

            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1.5 leading-snug">
              {rule5.sentence}
            </h3>

            {rule5.hasEnoughData ? (
              <div>
                <div className="h-32 w-full mt-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        {
                          category: 'Run Days',
                          Okay: rule5.data.runDays.feelCounts.okay,
                          High: rule5.data.runDays.feelCounts.high,
                          Low: rule5.data.runDays.feelCounts.low,
                        },
                        {
                          category: 'No-Run Days',
                          Okay: rule5.data.nonRunDays.feelCounts.okay,
                          High: rule5.data.nonRunDays.feelCounts.high,
                          Low: rule5.data.nonRunDays.feelCounts.low,
                        },
                      ]}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <XAxis dataKey="category" tick={{ fontSize: 10 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="Okay" fill="#16a34a" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="High" fill="#ea580c" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Low" fill="#dc2626" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedEntryList({
                        title: rule5.title,
                        entries: rule5.supportingEntries || [],
                      })
                    }
                    className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                  >
                    View run correlation entries ({rule5.supportingEntries?.length || 0})
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 mt-2">
                Need at least 3 logged days with activity and feel data.
              </p>
            )}
            <p className="text-[10px] text-slate-400 italic mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60">
              {rule5.disclaimer}
            </p>
          </div>
        )}

        {/* RULE 6: Feel vs Glucose Calibration (Stubbed until readings exist) */}
        {rule6 && (
          <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                Pattern 6 · Feel vs Meter Calibration
              </span>
              <span className="text-[10px] text-slate-400">Within 30 min</span>
            </div>

            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1.5 leading-snug">
              {rule6.sentence}
            </h3>

            {rule6.hasEnoughData ? (
              <div>
                <div className="h-32 w-full mt-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={rule6.data.feelCalibrations.map((c) => ({
                        feel: c.label,
                        avg: c.avgMgDl,
                      }))}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <XAxis dataKey="feel" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 400]} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="avg" name="Avg mg/dL" fill="#e11d48" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-1 mt-2 text-xs text-slate-600 dark:text-slate-300">
                  {rule6.data.feelCalibrations.map((c) => (
                    <div key={c.feel} className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-700">
                      <span className="font-semibold">{c.label} ({c.count} readings):</span>
                      <span className="font-bold">{c.minMgDl}–{c.maxMgDl} mg/dL (avg {c.avgMgDl})</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedEntryList({
                        title: rule6.title,
                        entries: rule6.supportingEntries || [],
                      })
                    }
                    className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                  >
                    View paired calibrations ({rule6.supportingEntries?.length || 0})
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center">
                <p className="text-xs text-slate-500 font-medium">
                  Not enough data yet — keep logging.
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Once your meter arrives in Bangalore and you log readings within 30 minutes of feels, calibration will populate automatically.
                </p>
              </div>
            )}
            <p className="text-[10px] text-slate-400 italic mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60">
              {rule6.disclaimer}
            </p>
          </div>
        )}
      </div>

      {/* Supporting Entries Modal */}
      {selectedEntryList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-5 shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {selectedEntryList.title}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedEntryList.entries.length} supporting log entries
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEntryList(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-2">
              {selectedEntryList.entries.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No entries.</p>
              ) : (
                selectedEntryList.entries.map((entry, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300"
                  >
                    <div className="font-bold text-slate-900 dark:text-slate-100 text-[11px] mb-0.5">
                      {entry.date}
                    </div>
                    <div>{entry.description}</div>
                  </div>
                ))
              )}
            </div>

            <button
              type="button"
              onClick={() => setSelectedEntryList(null)}
              className="w-full mt-2 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs hover:bg-slate-200"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
