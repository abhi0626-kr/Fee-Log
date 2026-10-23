'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  getFeelLogs,
  getFoodLogs,
  getActivityLogs,
  getAllLoggedDates,
} from '@/lib/sync-storage';
import { getTodayIST, timeToMinutes, minutesToTime, formatISTTime } from '@/lib/date-utils';
import { FEEL_COLORS, FeelLevel } from '@/types';

export default function SummaryPage() {
  const [windowDays, setWindowDays] = useState<number>(14);

  const [feelDistribution, setFeelDistribution] = useState<
    { name: string; key: FeelLevel; count: number; color: string }[]
  >([]);
  const [avgLunchTimeStr, setAvgLunchTimeStr] = useState<string>('N/A');
  const [daysLogged, setDaysLogged] = useState<number>(0);
  const [runDaysCount, setRunDaysCount] = useState<number>(0);
  const [nonRunDaysCount, setNonRunDaysCount] = useState<number>(0);
  const [weeklyTrends, setWeeklyTrends] = useState<{ week: string; highCount: number }[]>([]);

  useEffect(() => {
    const feels = getFeelLogs();
    const foods = getFoodLogs();
    const activities = getActivityLogs();
    const allDates = getAllLoggedDates();

    const today = getTodayIST();
    const [ty, tm, td] = today.split('-').map(Number);
    const end = new Date(Date.UTC(ty, tm - 1, td, 23, 59, 59));
    const start = new Date(end.getTime() - windowDays * 24 * 60 * 60 * 1000);
    const startStr = start.toISOString().slice(0, 10);

    // Filter in window
    const windowFeels = feels.filter((f) => f.log_date >= startStr && f.log_date <= today);
    const windowFoods = foods.filter((f) => f.log_date >= startStr && f.log_date <= today);
    const windowActivities = activities.filter((a) => a.log_date >= startStr && a.log_date <= today);

    // 1. Feel distribution
    const feelOrder: FeelLevel[] = ['low', 'slightly_low', 'okay', 'slightly_high', 'high'];
    const dist = feelOrder.map((fKey) => {
      const count = windowFeels.filter((f) => f.feel === fKey).length;
      return {
        name: FEEL_COLORS[fKey].label,
        key: fKey,
        count,
        color: fKey === 'okay' ? '#4edea3' : fKey === 'slightly_low' || fKey === 'slightly_high' ? '#ffb95f' : fKey === 'high' ? '#e29100' : '#ffb4ab',
      };
    });
    setFeelDistribution(dist);

    // 2. Average lunch time
    const lunchLogs = windowFoods.filter((f) => f.meal === 'lunch');
    if (lunchLogs.length > 0) {
      const totalMinutes = lunchLogs.reduce((acc, f) => acc + timeToMinutes(f.log_time), 0);
      const avgMinutes = Math.round(totalMinutes / lunchLogs.length);
      const rawAvgTime = minutesToTime(avgMinutes);
      setAvgLunchTimeStr(formatISTTime(rawAvgTime));
    } else {
      setAvgLunchTimeStr('N/A');
    }

    // 3. Days logged vs days in window
    const uniqueLoggedDaysInWindow = new Set<string>();
    allDates.forEach((d) => {
      if (d >= startStr && d <= today) uniqueLoggedDaysInWindow.add(d);
    });
    setDaysLogged(uniqueLoggedDaysInWindow.size);

    // 4. Run vs non-run days count
    const runDays = new Set<string>();
    windowActivities.forEach((a) => {
      if (a.activity_type === 'run') runDays.add(a.log_date);
    });
    const runCount = runDays.size;
    const nonRunCount = Math.max(0, uniqueLoggedDaysInWindow.size - runCount);
    setRunDaysCount(runCount);
    setNonRunDaysCount(nonRunCount);

    // 5. Weekly trend
    const trends: { week: string; highCount: number }[] = [];
    for (let w = 3; w >= 0; w--) {
      const wEnd = new Date(end.getTime() - w * 7 * 24 * 60 * 60 * 1000);
      const wStart = new Date(wEnd.getTime() - 6 * 24 * 60 * 60 * 1000);
      const wStartStr = wStart.toISOString().slice(0, 10);
      const wEndStr = wEnd.toISOString().slice(0, 10);

      const highCount = feels.filter(
        (f) =>
          f.log_date >= wStartStr &&
          f.log_date <= wEndStr &&
          (f.feel === 'high' || f.feel === 'slightly_high')
      ).length;

      trends.push({
        week: `${w === 0 ? 'Current' : `${w}w ago`}`,
        highCount,
      });
    }
    setWeeklyTrends(trends);
  }, [windowDays]);

  return (
    <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-2">
        <div>
          <div className="flex items-center gap-2 text-primary font-label-md text-xs uppercase tracking-wider mb-1 font-bold">
            <span className="material-symbols-outlined text-[1rem]">bar_chart</span>
            <span>Health Metrics &amp; Aggregates</span>
          </div>
          <h1 className="font-headline-xl text-2xl md:text-3xl text-on-surface font-extrabold tracking-tight">
            Metabolic Summary
          </h1>
          <p className="font-body-md text-sm text-on-surface-variant mt-1">
            High-level overview of meals, habits, and subjective symptoms across chosen window.
          </p>
        </div>

        {/* Window Selector */}
        <div className="inline-flex p-1 rounded-full bg-surface-container-lowest border border-white/5 backdrop-blur-xl shadow-inner">
          {[
            { label: 'Past 7 Days', val: 7 },
            { label: 'Past 14 Days', val: 14 },
            { label: 'Past 30 Days', val: 30 },
          ].map((opt) => (
            <button
              key={opt.val}
              type="button"
              onClick={() => setWindowDays(opt.val)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                windowDays === opt.val
                  ? 'bg-surface-container-high text-on-surface shadow-md border border-white/10 font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-surface-container-low/70 border border-white/5 backdrop-blur-xl shadow-lg">
          <span className="font-label-md text-xs text-on-surface-variant uppercase">Tracking Consistency</span>
          <div className="font-label-numeric text-2xl text-primary font-bold mt-1">
            {daysLogged} / {windowDays} <span className="text-sm font-normal text-on-surface-variant">days</span>
          </div>
          <div className="text-[0.7rem] text-primary mt-1 font-semibold">Active PG habit</div>
        </div>

        <div className="p-4 rounded-2xl bg-surface-container-low/70 border border-white/5 backdrop-blur-xl shadow-lg">
          <span className="font-label-md text-xs text-on-surface-variant uppercase">Avg Lunch Timing</span>
          <div className="font-label-numeric text-2xl text-on-surface font-bold mt-1">
            {avgLunchTimeStr}
          </div>
          <div className="text-[0.7rem] text-on-surface-variant mt-1">Bangalore PG mess window</div>
        </div>

        <div className="p-4 rounded-2xl bg-surface-container-low/70 border border-white/5 backdrop-blur-xl shadow-lg">
          <span className="font-label-md text-xs text-on-surface-variant uppercase">Run vs Non-Run</span>
          <div className="font-label-numeric text-2xl text-secondary font-bold mt-1">
            {runDaysCount} : {nonRunDaysCount}
          </div>
          <div className="text-[0.7rem] text-secondary mt-1 font-semibold">Cubbon park aerobic days</div>
        </div>

        <div className="p-4 rounded-2xl bg-surface-container-low/70 border border-white/5 backdrop-blur-xl shadow-lg">
          <span className="font-label-md text-xs text-on-surface-variant uppercase">Post-Meal Spikes</span>
          <div className="font-label-numeric text-2xl text-tertiary font-bold mt-1">
            {feelDistribution.find((d) => d.key === 'slightly_high')?.count || 0}
          </div>
          <div className="text-[0.7rem] text-tertiary mt-1 font-semibold">Slightly high check-ins</div>
        </div>
      </div>

      {/* Visual Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Feel Distribution */}
        <div className="p-6 rounded-3xl bg-surface-container-low/70 border border-white/5 backdrop-blur-xl shadow-xl">
          <h3 className="font-headline-sm text-sm font-bold text-on-surface mb-1">
            Sensory Feel Distribution
          </h3>
          <p className="text-xs text-on-surface-variant mb-4">
            Aggregated tally across Low, Okay, and High check-in sensations.
          </p>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={feelDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <XAxis dataKey="name" tick={{ fill: '#bbcabf', fontSize: 11 }} />
                <YAxis tick={{ fill: '#bbcabf', fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#171f33', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '1rem', color: '#dae2fd' }}
                />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {feelDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Weekly High-Feel Trends */}
        <div className="p-6 rounded-3xl bg-surface-container-low/70 border border-white/5 backdrop-blur-xl shadow-xl">
          <h3 className="font-headline-sm text-sm font-bold text-on-surface mb-1">
            Weekly Afternoon High Trends
          </h3>
          <p className="text-xs text-on-surface-variant mb-4">
            Count of 3–7 PM high/sluggish feeling episodes week-by-week.
          </p>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyTrends} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <XAxis dataKey="week" tick={{ fill: '#bbcabf', fontSize: 11 }} />
                <YAxis tick={{ fill: '#bbcabf', fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#171f33', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '1rem', color: '#dae2fd' }}
                />
                <Bar dataKey="highCount" fill="#ffb95f" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
