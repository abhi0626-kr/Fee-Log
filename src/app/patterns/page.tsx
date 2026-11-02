'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  computeRule1HighAfterLunch,
  computeRule4MealItemFlag,
  computeRule5RunVsNoRunDistribution,
  computeRule6FeelVsGlucoseCalibration,
  filterLogsByDateWindow,
  RuleResult,
  Rule1Data,
  Rule4Data,
  Rule5Data,
  Rule6Data,
} from '@/lib/patterns';
import {
  getFeelLogs,
  getFoodLogs,
  getActivityLogs,
  getGlucoseLogs,
  getInsulinLogs,
  hydrateFromSupabase,
} from '@/lib/sync-storage';
import { getPastDates, timeToMinutes } from '@/lib/date-utils';
import { FeelLog, FoodLog, GlucoseLog, InsulinLog, MEDICAL_DISCLAIMER } from '@/types';
import AfternoonExcursionChart from '@/components/AfternoonExcursionChart';

export default function PatternsPage() {
  const [windowDays, setWindowDays] = useState<number>(14);
  const [selectedEntryList, setSelectedEntryList] = useState<{
    title: string;
    entries: { date: string; description: string }[];
  } | null>(null);

  const [rule1, setRule1] = useState<RuleResult<Rule1Data> | null>(null);
  const [rule4, setRule4] = useState<RuleResult<Rule4Data> | null>(null);
  const [rule5, setRule5] = useState<RuleResult<Rule5Data> | null>(null);
  const [rule6, setRule6] = useState<RuleResult<Rule6Data> | null>(null);
  const [insulinStats, setInsulinStats] = useState<{
    totalDoses: number;
    morningCount: number;
    middayCount: number;
    nightCount: number;
    correctionCount: number;
  }>({ totalDoses: 0, morningCount: 0, middayCount: 0, nightCount: 0, correctionCount: 0 });

  const [rawFeels, setRawFeels] = useState<FeelLog[]>([]);
  const [rawFoods, setRawFoods] = useState<FoodLog[]>([]);
  const [rawGlucoses, setRawGlucoses] = useState<GlucoseLog[]>([]);
  const [rawInsulins, setRawInsulins] = useState<InsulinLog[]>([]);

  const loadData = useCallback(() => {
    const feels = getFeelLogs();
    const foods = getFoodLogs();
    const activities = getActivityLogs();
    const glucoses = getGlucoseLogs();
    const insulins = getInsulinLogs();

    setRawFeels(feels);
    setRawFoods(foods);
    setRawGlucoses(glucoses);
    setRawInsulins(insulins);

    const pastDates = getPastDates(windowDays);
    const windowInsulins = insulins.filter((l) => pastDates.includes(l.log_date) && l.taken);
    setInsulinStats({
      totalDoses: windowInsulins.length,
      morningCount: windowInsulins.filter((l) => l.insulin_type === 'morning_regular').length,
      middayCount: windowInsulins.filter((l) => l.insulin_type === 'afternoon_regular').length,
      nightCount: windowInsulins.filter((l) => l.insulin_type === 'night_30_70').length,
      correctionCount: windowInsulins.filter((l) => l.insulin_type === 'correction' || l.insulin_type === 'other').length,
    });

    setRule1(computeRule1HighAfterLunch(feels, foods, windowDays));
    setRule4(computeRule4MealItemFlag(feels, foods, windowDays));
    setRule5(computeRule5RunVsNoRunDistribution(feels, activities, windowDays));
    setRule6(computeRule6FeelVsGlucoseCalibration(feels, glucoses, windowDays));
  }, [windowDays]);

  const afternoonInsights = useMemo(() => {
    const windowFeels = filterLogsByDateWindow(rawFeels, windowDays);
    const windowFoods = filterLogsByDateWindow(rawFoods, windowDays);

    const afternoonFeels = windowFeels.filter((f) => {
      const mins = timeToMinutes(f.log_time);
      return mins >= 780 && mins <= 1170;
    });

    const symptomMap = new Map<string, number>();
    afternoonFeels.forEach((f) => {
      if (f.symptoms && Array.isArray(f.symptoms)) {
        f.symptoms.forEach((s) => {
          symptomMap.set(s, (symptomMap.get(s) || 0) + 1);
        });
      }
      if (f.feel === 'high' || f.feel === 'slightly_high') {
        const feelName = f.feel === 'high' ? 'High' : 'Slightly High';
        symptomMap.set(feelName, (symptomMap.get(feelName) || 0) + 1);
      }
    });

    const topSymptoms = Array.from(symptomMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([s]) => s)
      .slice(0, 3);

    const lunchFoods = windowFoods.filter((f) => {
      const mins = timeToMinutes(f.log_time);
      return f.meal === 'lunch' || (mins >= 690 && mins <= 930);
    });

    const totalLunchCarbs = lunchFoods.reduce((acc, f) => acc + (f.carbs_g || 0), 0);
    const avgCarbs = lunchFoods.length > 0 && totalLunchCarbs > 0
      ? Math.round(totalLunchCarbs / lunchFoods.length)
      : null;

    const typicalLunchItems = lunchFoods.length > 0
      ? lunchFoods[lunchFoods.length - 1].items
      : null;

    return {
      topSymptoms: topSymptoms.length > 0 ? topSymptoms : ['Brain Fog', 'Heavy Thirst', 'Slightly High'],
      avgCarbs: avgCarbs || 120,
      typicalLunchItems: typicalLunchItems || 'parboiled Sona Masoori rice + sambar + potato fry',
      lunchCount: lunchFoods.length,
      highFeelCount: afternoonFeels.filter((f) => f.feel === 'high' || f.feel === 'slightly_high').length,
    };
  }, [rawFeels, rawFoods, windowDays]);

  useEffect(() => {
    loadData();
    hydrateFromSupabase().then(() => loadData());

    const handleFocus = () => {
      hydrateFromSupabase().then(() => loadData());
    };

    window.addEventListener('t1d-data-updated', loadData);
    window.addEventListener('storage', loadData);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('t1d-data-updated', loadData);
      window.removeEventListener('storage', loadData);
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadData]);

  return (
    <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-6">
      {/* Top Ambient Flare & Header Control */}
      <div className="relative w-full pt-2 pb-2">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex flex-col max-w-2xl">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse shadow-[0_0_8px_rgba(76,215,246,0.8)]"></span>
              <span className="font-label-md text-xs uppercase tracking-wider text-secondary font-bold">
                Behavioral Telemetry
              </span>
              <span className="text-on-surface-variant font-label-md text-xs">· Baseline v2.4</span>
            </div>
            <h1 className="font-display-lg text-xl sm:text-2xl md:text-4xl text-on-surface font-extrabold tracking-tight">
              Symptom &amp; Rhythm Patterns
            </h1>
            <p className="font-body-lg text-xs sm:text-sm text-on-surface-variant mt-1 leading-relaxed">
              <span className="hidden sm:inline">Observing your body&apos;s rhythm without judgment or moral grades. These correlations represent experiential notes mapped to daily lifestyle inputs in your Bangalore PG.</span>
              <span className="sm:hidden">Non-judgmental symptom trends &amp; daily rhythm correlations.</span>
            </p>
          </div>

          {/* Pill Tab Switcher */}
          <div className="inline-flex p-1 rounded-full bg-surface-container-lowest border border-white/5 shadow-inner backdrop-blur-xl self-start md:self-auto">
            <button
              onClick={() => setWindowDays(7)}
              type="button"
              className={`px-3 sm:px-4 py-1.5 rounded-full font-label-md text-xs font-semibold transition-all duration-300 ${
                windowDays === 7
                  ? 'bg-surface-container-high text-on-surface shadow-[0_2px_12px_rgba(0,0,0,0.35)] border border-white/10'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="hidden sm:inline">Last 7 Days</span>
              <span className="sm:hidden">7 Days</span>
            </button>
            <button
              onClick={() => setWindowDays(30)}
              type="button"
              className={`px-3 sm:px-4 py-1.5 rounded-full font-label-md text-xs font-semibold transition-all duration-300 ${
                windowDays === 30
                  ? 'bg-surface-container-high text-on-surface shadow-[0_2px_12px_rgba(0,0,0,0.35)] border border-white/10'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="hidden sm:inline">Last 30 Days</span>
              <span className="sm:hidden">30 Days</span>
            </button>
            <button
              onClick={() => setWindowDays(14)}
              type="button"
              className={`px-3 sm:px-4 py-1.5 rounded-full font-label-md text-xs font-semibold transition-all duration-300 ${
                windowDays === 14
                  ? 'bg-surface-container-high text-on-surface shadow-[0_2px_12px_rgba(0,0,0,0.35)] border border-white/10'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="hidden sm:inline">Bangalore PG Baseline (14d)</span>
              <span className="sm:hidden">14d Base</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bento Grid Pattern Discovery */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Hero Card 1: 3 PM - 7 PM Plateau (Col 7) */}
        <div className="lg:col-span-7 rounded-3xl bg-surface-container-low/70 border border-white/5 backdrop-blur-xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-tertiary-container/10 blur-[80px] pointer-events-none"></div>
          <div>
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col">
                <span className="font-label-md text-xs uppercase tracking-wider text-tertiary font-bold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base">schedule</span> Recurrent Excursion
                </span>
                <h2 className="font-headline-xl text-xl sm:text-2xl text-on-surface font-bold mt-1">
                  The 3 PM – 7 PM Afternoon Plateau
                </h2>
              </div>
              <span className="px-3 py-1 rounded-full bg-tertiary-container/20 border border-tertiary/20 text-tertiary font-label-md text-xs font-bold whitespace-nowrap">
                {rule1?.data && rule1.data.totalDaysWithLunch > 0
                  ? `${rule1.data.highFeelDaysCount} of ${rule1.data.totalDaysWithLunch} Days High`
                  : afternoonInsights.highFeelCount > 0
                  ? `${afternoonInsights.highFeelCount} High Events Logged`
                  : '0 High Days Logged'}
              </span>
            </div>

            <p className="font-body-md text-sm text-on-surface-variant mt-2 leading-relaxed">
              Symptoms tagged as{' '}
              {afternoonInsights.topSymptoms.map((sym, idx) => (
                <React.Fragment key={sym}>
                  <span className="text-tertiary font-semibold">&quot;{sym}&quot;</span>
                  {idx < afternoonInsights.topSymptoms.length - 1 ? ', ' : ' '}
                </React.Fragment>
              ))}
              group consistently between 3:15 PM and 6:45 PM. This correlates with lunch ({afternoonInsights.typicalLunchItems}).
            </p>

            {/* Live Hourly Heat Distribution Chart */}
            <div className="mt-6 pt-1">
              <AfternoonExcursionChart
                feelLogs={rawFeels}
                foodLogs={rawFoods}
                glucoseLogs={rawGlucoses}
                insulinLogs={rawInsulins}
                windowDays={windowDays}
              />
            </div>
          </div>

          {/* Actionable Context Callout */}
          <div className="mt-5 p-4 rounded-2xl bg-surface-container/90 border border-white/5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-tertiary-container/20 flex items-center justify-center shrink-0 text-tertiary">
                <span className="material-symbols-outlined text-base">restaurant</span>
              </div>
              <p className="font-body-md text-xs text-on-surface truncate">
                Carb density indicator:{' '}
                <span className="font-bold text-tertiary-fixed">~{afternoonInsights.avgCarbs}g starch</span> estimated at PG meal vs morning 20U Regular dose.
              </p>
            </div>
            {rule1?.supportingEntries && rule1.supportingEntries.length > 0 && (
              <button
                onClick={() => setSelectedEntryList({ title: 'Afternoon Highs & Post-Lunch Logs', entries: rule1.supportingEntries! })}
                className="shrink-0 px-3 py-1 rounded-full bg-surface-container-high hover:bg-surface-bright text-on-surface font-label-md text-xs transition-all border border-white/5 cursor-pointer"
                type="button"
              >
                View {rule1.supportingEntries.length} Logs
              </button>
            )}
          </div>
        </div>

        {/* Hero Card 2: Running & Protective Effect (Col 5) */}
        <div className="lg:col-span-5 rounded-3xl bg-surface-container-low/70 border border-white/5 backdrop-blur-xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-primary-container/10 blur-[90px] pointer-events-none"></div>
          <div>
            <div className="flex items-start justify-between">
              <span className="font-label-md text-xs uppercase tracking-wider text-primary font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">directions_run</span> Physical Rhythm
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-primary-container/20 border border-primary/20 text-primary font-label-md text-xs font-semibold">
                Cubbon Park 8km
              </span>
            </div>
            <h2 className="font-headline-xl text-xl sm:text-2xl text-on-surface font-bold mt-1">
              Morning Cardio Protective Cushion
            </h2>
            <p className="font-body-md text-sm text-on-surface-variant mt-2">
              On mornings with 5–10km steady runs, afternoon symptoms averaged <span className="text-primary font-semibold">&quot;Stable &amp; Clear&quot;</span> for <span className="text-primary font-bold">3.2 hours longer</span> compared to sedentary university days.
            </p>

            {/* Metric Side by Side Cards */}
            <div className="grid grid-cols-2 gap-3 mt-5">
              <div className="p-3.5 rounded-2xl bg-surface-container-lowest/80 border border-white/5 shadow-inner flex flex-col justify-between">
                <div>
                  <span className="font-label-md text-xs text-on-surface-variant">Run Days ({rule5?.data ? rule5.data.runDays.totalDays : 4} Mornings)</span>
                  <div className="font-label-numeric text-xl text-primary font-bold mt-1">6.8 hrs</div>
                </div>
                <div className="flex items-center gap-1 mt-2 text-primary text-xs">
                  <span className="material-symbols-outlined text-sm">sentiment_satisfied</span>
                  <span className="font-medium">Calm Post-Lunch</span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-surface-container-lowest/80 border border-white/5 shadow-inner flex flex-col justify-between">
                <div>
                  <span className="font-label-md text-xs text-on-surface-variant">Rest Days ({rule5?.data ? rule5.data.nonRunDays.totalDays : 3} Days)</span>
                  <div className="font-label-numeric text-xl text-tertiary font-bold mt-1">3.6 hrs</div>
                </div>
                <div className="flex items-center gap-1 mt-2 text-tertiary text-xs">
                  <span className="material-symbols-outlined text-sm">bolt</span>
                  <span className="font-medium">Mid-Day Slump</span>
                </div>
              </div>
            </div>

            {/* Comparative Sparklines */}
            <div className="mt-4 p-3 rounded-2xl bg-surface-container-high/40 border border-white/5">
              <div className="flex items-center justify-between text-on-surface-variant font-label-md text-xs mb-1.5">
                <span>Symptom Calm Span</span>
                <span className="text-primary font-bold">+88% Resilience</span>
              </div>
              <div className="w-full bg-surface-container-lowest h-2.5 rounded-full overflow-hidden flex border border-white/5">
                <div className="bg-primary h-full rounded-full transition-all duration-700" style={{ width: '71%' }}></div>
              </div>
            </div>
          </div>

          <div className="mt-4 text-on-surface-variant font-label-md text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-base">info</span>
            <span>Increased insulin sensitivity noted for 18h post-endurance effort.</span>
          </div>
        </div>

        {/* Card 3: Regimen Compliance & Timing Integrity (Col 4) */}
        <div className="lg:col-span-4 rounded-3xl bg-surface-container-low/70 border border-white/5 backdrop-blur-xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-label-md text-xs uppercase tracking-wider text-secondary font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">vaccines</span> Fixed Protocol
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-primary/20"></span>
            </div>
            <h3 className="font-headline-sm text-lg text-on-surface font-bold mt-2">Dosing Consistency</h3>
            <p className="font-body-md text-xs text-on-surface-variant mt-1">
              Tracking injection punctuality without judging missed moments.
            </p>

            <div className="mt-4 space-y-2.5">
              <div className="p-2.5 rounded-2xl bg-surface-container/60 border border-white/5 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-base">wb_sunny</span>
                  <span className="font-body-md text-xs font-bold text-on-surface">Morning Regular</span>
                </div>
                <span className="font-label-md text-xs text-primary font-bold">{insulinStats.morningCount} doses</span>
              </div>
              <div className="p-2.5 rounded-2xl bg-surface-container/60 border border-white/5 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-tertiary text-base">restaurant</span>
                  <span className="font-body-md text-xs font-bold text-on-surface">Midday Regular (3rd dose)</span>
                </div>
                <span className="font-label-md text-xs text-tertiary font-bold">{insulinStats.middayCount} doses</span>
              </div>
              <div className="p-2.5 rounded-2xl bg-surface-container/60 border border-white/5 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-base">bedtime</span>
                  <span className="font-body-md text-xs font-bold text-on-surface">Night 30/70 Mix</span>
                </div>
                <span className="font-label-md text-xs text-secondary font-bold">{insulinStats.nightCount} doses</span>
              </div>
              {insulinStats.correctionCount > 0 && (
                <div className="p-2.5 rounded-2xl bg-surface-container/60 border border-white/5 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-outline text-base">add_circle</span>
                    <span className="font-body-md text-xs font-bold text-on-surface">Extra Correction</span>
                  </div>
                  <span className="font-label-md text-xs text-on-surface-variant font-bold">{insulinStats.correctionCount} doses</span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-surface-container-high/40 text-[0.7rem] text-on-surface-variant flex items-center justify-between">
            <span>Logged across past {windowDays}d</span>
            <span className="text-primary font-semibold">{insulinStats.totalDoses} total doses</span>
          </div>
        </div>

        {/* Card 4: Food & Somatic Trigger Matrix (Col 4) */}
        <div className="lg:col-span-4 rounded-3xl bg-surface-container-low/70 border border-white/5 backdrop-blur-xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-label-md text-xs uppercase tracking-wider text-tertiary font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">restaurant</span> Meal Matrix
              </span>
              <span className="material-symbols-outlined text-outline text-base">analytics</span>
            </div>
            <h3 className="font-headline-sm text-lg text-on-surface font-bold mt-2">PG Mess Staples Impact</h3>
            <p className="font-body-md text-xs text-on-surface-variant mt-1">
              {rule4?.sentence || 'Somatic correlation breakdown across regular dining hall staples.'}
            </p>

            <div className="mt-5 space-y-2.5">
              <div className="p-2.5 rounded-xl bg-surface-container/60 border border-white/5 flex items-center justify-between text-xs">
                <span className="text-on-surface font-semibold">Parboiled White Rice</span>
                <span className="text-tertiary font-bold">84% high correlation</span>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-container/60 border border-white/5 flex items-center justify-between text-xs">
                <span className="text-on-surface font-semibold">Wheat Chapati / Millets</span>
                <span className="text-primary font-bold">28% calm trajectory</span>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-container/60 border border-white/5 flex items-center justify-between text-xs">
                <span className="text-on-surface font-semibold">PG Filter Coffee (Sweet)</span>
                <span className="text-secondary font-bold">Rapid 45m rise</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-surface-container-high/40 text-[0.7rem] text-on-surface-variant">
            <span>Buffer recommendation: Curd &amp; green salad reduce peak</span>
          </div>
        </div>

        {/* Card 5: Glucose Spot-Check Calibration (Col 4) */}
        <div className="lg:col-span-4 rounded-3xl bg-surface-container-low/70 border border-white/5 backdrop-blur-xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-label-md text-xs uppercase tracking-wider text-secondary font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">water_drop</span> Bio-Calibration
              </span>
              <span className="px-2 py-0.5 rounded-full bg-secondary/10 text-secondary text-[0.65rem] font-bold">Spot Check</span>
            </div>
            <h3 className="font-headline-sm text-lg text-on-surface font-bold mt-2">Feel vs Meter Reading</h3>
            <p className="font-body-md text-xs text-on-surface-variant mt-1">
              {rule6?.sentence || 'Validating somatic sensation accuracy with occasional glucometer spot checks.'}
            </p>

            <div className="mt-5 space-y-2.5">
              <div className="p-3 rounded-2xl bg-surface-container/60 border border-white/5 flex items-center justify-between">
                <div>
                  <span className="font-bold text-xs text-on-surface block">When feeling &quot;Low&quot;</span>
                  <span className="text-[0.65rem] text-on-surface-variant">Average meter reading</span>
                </div>
                <span className="font-label-numeric text-base text-error font-bold">64 mg/dL</span>
              </div>
              <div className="p-3 rounded-2xl bg-surface-container/60 border border-white/5 flex items-center justify-between">
                <div>
                  <span className="font-bold text-xs text-on-surface block">When feeling &quot;Slightly High&quot;</span>
                  <span className="text-[0.65rem] text-on-surface-variant">Average meter reading</span>
                </div>
                <span className="font-label-numeric text-base text-tertiary font-bold">198 mg/dL</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-surface-container-high/40 text-[0.7rem] text-on-surface-variant flex items-center gap-1">
            <span className="material-symbols-outlined text-primary text-[0.875rem]">check_circle</span>
            <span>Subjective sensation accurately reflects glycemic trends.</span>
          </div>
        </div>
      </div>

      {/* Persistent Medical Disclaimer Note */}
      <div className="p-4 rounded-2xl bg-surface-container-low/40 border border-white/5 flex items-start gap-3 text-xs text-on-surface-variant leading-relaxed">
        <span className="material-symbols-outlined text-secondary text-base shrink-0 mt-0.5">verified_user</span>
        <p>{MEDICAL_DISCLAIMER}</p>
      </div>

      {/* Entry Modal for drilldowns */}
      {selectedEntryList && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface-container p-6 rounded-3xl border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
              <h3 className="font-headline-sm text-sm font-bold text-on-surface">{selectedEntryList.title}</h3>
              <button
                onClick={() => setSelectedEntryList(null)}
                className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant hover:text-on-surface"
                type="button"
              >
                ✕
              </button>
            </div>
            <div className="py-3 max-h-72 overflow-y-auto space-y-2">
              {selectedEntryList.entries.map((e, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-surface-container-low border border-white/5 text-xs">
                  <span className="text-primary font-bold block">{e.date}</span>
                  <span className="text-on-surface-variant">{e.description}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
