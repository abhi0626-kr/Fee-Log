'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Calendar,
  Clock,
  Activity as ActivityIcon,
  HeartPulse,
  TrendingUp,
} from 'lucide-react';
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
        color: FEEL_COLORS[fKey].hex,
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

    // 5. Weekly trend: High-feel count per week over the last 4 weeks
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
        week: `W-${w === 0 ? 'Current' : `${w}w ago`}`,
        highCount,
      });
    }
    setWeeklyTrends(trends);
  }, [windowDays]);

  return (
    <div className="pb-28 max-w-lg mx-auto px-4 pt-4">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wider">
          <BarChart3 className="w-4 h-4" />
          <span>Health Metrics</span>
        </div>
        <h1 className="text-xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
          Weekly Summary
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          High-level overview of meals, habits, and symptoms
        </p>
      </div>

      {/* Window Selector */}
      <div className="flex items-center justify-between mb-5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
        {[
          { label: 'Past 7 Days', val: 7 },
          { label: 'Past 14 Days', val: 14 },
          { label: 'Past 30 Days', val: 30 },
        ].map((opt) => (
          <button
            key={opt.val}
            type="button"
            onClick={() => setWindowDays(opt.val)}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
              windowDays === opt.val
                ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-300 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* 4 Quick Stat Metric Cards */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {/* Days Logged */}
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-3.5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold mb-1">
            <Calendar className="w-3.5 h-3.5 text-teal-600" />
            <span>Logging Consistency</span>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
            {daysLogged} / {windowDays}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">days with recorded logs</p>
        </div>

        {/* Average Lunch Time */}
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-3.5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold mb-1">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span>Avg Lunch Time</span>
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-slate-100">
            {avgLunchTimeStr}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">IST lunch schedule</p>
        </div>

        {/* Run vs Non-Run */}
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-3.5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold mb-1">
            <ActivityIcon className="w-3.5 h-3.5 text-blue-600" />
            <span>Running Days</span>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
            {runDaysCount} <span className="text-xs text-slate-400 font-normal">vs {nonRunDaysCount} rest</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">5–10 km morning runs</p>
        </div>

        {/* High Feelings */}
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-3.5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold mb-1">
            <HeartPulse className="w-3.5 h-3.5 text-orange-600" />
            <span>High Feelings</span>
          </div>
          <div className="text-2xl font-black text-orange-600">
            {feelDistribution.find((f) => f.key === 'high')?.count || 0 + (feelDistribution.find((f) => f.key === 'slightly_high')?.count || 0)}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">total high symptom events</p>
        </div>
      </div>

      {/* Feel Ratings Distribution Chart */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-4 shadow-sm mb-5">
        <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
          Feel Rating Distribution
        </h3>
        <p className="text-[11px] text-slate-500 mb-3">
          Breakdown of logged subjective feelings over the selected period
        </p>

        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={feelDistribution}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {feelDistribution.map((entry) => (
                  <Cell key={entry.key} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* High-Feel Weekly Trend */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-4 shadow-sm mb-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            High-Feel Trend (Last 4 Weeks)
          </h3>
          <TrendingUp className="w-4 h-4 text-orange-500" />
        </div>
        <p className="text-[11px] text-slate-500 mb-3">
          Weekly count of slightly high & high feelings
        </p>

        <div className="h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={weeklyTrends}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <XAxis dataKey="week" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="highCount" name="High Symptoms" fill="#f97316" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
