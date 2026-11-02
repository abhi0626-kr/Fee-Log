'use client';

import React, { useMemo, useState } from 'react';
import { UnifiedLogItem } from '@/types';
import { timeToMinutes, formatISTTime } from '@/lib/date-utils';

interface DayRhythmChartProps {
  logs: UnifiedLogItem[];
  selectedDate: string;
}

interface RhythmDataPoint {
  timeStr: string;
  timeLabel: string;
  minutes: number;
  value: number; // 50 to 220 mg/dL equiv
  x: number;
  y: number;
  eventTitle?: string;
  eventType?: 'insulin' | 'food' | 'feel' | 'activity' | 'glucose';
  eventIcon?: string;
  isRealEvent?: boolean;
}

export default function DayRhythmChart({ logs, selectedDate }: DayRhythmChartProps) {
  const [activePoint, setActivePoint] = useState<RhythmDataPoint | null>(null);

  // Synthesize continuous physiological rhythm curve from real daily events
  const { chartData, splinePath, areaPath, peakPoint, lowestPoint, timeInRangePct, landmarkEvents } = useMemo(() => {
    if (!logs || logs.length === 0) {
      return {
        chartData: [] as RhythmDataPoint[],
        splinePath: '',
        areaPath: '',
        peakPoint: null,
        lowestPoint: null,
        timeInRangePct: 0,
        landmarkEvents: [] as UnifiedLogItem[],
      };
    }

    // Sort events chronologically
    const sortedLogs = [...logs].sort((a, b) => a.log_time.localeCompare(b.log_time));

    // Determine the time window for the chart
    const logMins = sortedLogs.map((l) => timeToMinutes(l.log_time));
    const minMins = Math.max(0, Math.min(...logMins) - 60);
    const maxMins = Math.min(1440, Math.max(...logMins) + 90);

    const startMins = Math.min(minMins, 360); // At least 06:00 AM
    const endMins = Math.max(maxMins, 1320); // At least 10:00 PM
    const totalSpan = Math.max(1, endMins - startMins);

    // Coordinate mapping functions
    // SVG viewBox: 0 0 360 140
    // Chart area: x from 15 to 345 (width 330), y from 15 to 125 (height 110)
    const getY = (val: number) => {
      // Clamped physiologically between 50 and 220
      const clamped = Math.max(50, Math.min(220, val));
      return 125 - ((clamped - 50) / 170) * 105;
    };

    const getX = (mins: number) => {
      return 15 + ((mins - startMins) / totalSpan) * 330;
    };

    // Generate continuous curve sampled every 30 minutes
    const rawPoints: { minutes: number; value: number }[] = [];

    for (let m = startMins; m <= endMins; m += 30) {
      // 1. Baseline resting glycemia / felt energy index
      let val = 100;

      // 2. Direct Anchor: Feel check-ins or Glucose readings within 40 mins
      sortedLogs.forEach((l) => {
        const itemMins = timeToMinutes(l.log_time);
        const diff = Math.abs(m - itemMins);

        if (diff <= 40) {
          const weight = Math.max(0, 1 - diff / 40);
          if (l.category === 'glucose' && l.glucose) {
            val = val * (1 - weight) + l.glucose.reading_mgdl * weight;
          } else if (l.category === 'feel' && l.feel) {
            const feelTargets: Record<string, number> = {
              low: 65,
              slightly_low: 78,
              okay: 102,
              slightly_high: 150,
              high: 195,
            };
            const target = feelTargets[l.feel.feel] || 100;
            val = val * (1 - weight) + target * weight;
          }
        }
      });

      // 3. Meal glycemic excursion wave (post-meal curve peaks at 45–75 mins, lasts ~3 hours)
      sortedLogs.forEach((l) => {
        if (l.category === 'food' && l.food) {
          const mealMins = timeToMinutes(l.log_time);
          const dt = m - mealMins;
          if (dt >= 0 && dt <= 180) {
            let carbPeak = 35;
            if (l.food.carb_size === 'large') carbPeak = 55;
            else if (l.food.carb_size === 'small') carbPeak = 20;
            if (l.food.carbs_g && l.food.carbs_g > 0) {
              carbPeak = Math.min(65, Math.max(20, l.food.carbs_g * 0.45));
            }
            const wave = Math.sin((Math.PI * dt) / 180);
            val += carbPeak * wave;
          }
        }
      });

      // 4. Insulin action curve
      sortedLogs.forEach((l) => {
        if (l.category === 'insulin' && l.insulin && l.insulin.taken) {
          const insMins = timeToMinutes(l.log_time);
          const dt = m - insMins;
          if (dt >= 0 && dt <= 240) {
            const dropStrength = Math.min(45, (l.insulin.units || 20) * 1.8);
            const dropWave = Math.sin((Math.PI * dt) / 240);
            val -= dropStrength * dropWave;
          }
        }
      });

      // 5. Activity exertion effect
      sortedLogs.forEach((l) => {
        if (l.category === 'activity' && l.activity) {
          const actMins = timeToMinutes(l.log_time);
          const dt = m - actMins;
          if (dt >= 0 && dt <= 120) {
            const actWave = Math.sin((Math.PI * dt) / 120);
            val -= 18 * actWave;
          }
        }
      });

      rawPoints.push({
        minutes: m,
        value: Math.round(Math.max(55, Math.min(220, val))),
      });
    }

    // Convert raw points to RhythmDataPoints
    const points: RhythmDataPoint[] = rawPoints.map((rp) => {
      const matchedEvent = sortedLogs.find((evt) => Math.abs(timeToMinutes(evt.log_time) - rp.minutes) <= 18);

      let eventTitle: string | undefined;
      let eventType: RhythmDataPoint['eventType'];
      let eventIcon: string | undefined;

      if (matchedEvent) {
        eventType = matchedEvent.category;
        if (matchedEvent.category === 'food' && matchedEvent.food) {
          eventTitle = `${matchedEvent.food.meal.toUpperCase()}: ${matchedEvent.food.items}`;
          eventIcon = 'restaurant';
        } else if (matchedEvent.category === 'insulin' && matchedEvent.insulin) {
          eventTitle = `${matchedEvent.insulin.units}U ${matchedEvent.insulin.insulin_type.replace('_', ' ')}`;
          eventIcon = 'vaccines';
        } else if (matchedEvent.category === 'feel' && matchedEvent.feel) {
          eventTitle = `Feel: ${matchedEvent.feel.feel.replace('_', ' ').toUpperCase()}`;
          eventIcon = 'sentiment_satisfied';
        } else if (matchedEvent.category === 'activity' && matchedEvent.activity) {
          eventTitle = `${matchedEvent.activity.activity_type.toUpperCase()} (${matchedEvent.activity.duration_min || 30}m)`;
          eventIcon = 'directions_run';
        } else if (matchedEvent.category === 'glucose' && matchedEvent.glucose) {
          eventTitle = `${matchedEvent.glucose.reading_mgdl} mg/dL`;
          eventIcon = 'bloodtype';
        }
      }

      const h = Math.floor(rp.minutes / 60);
      const m = rp.minutes % 60;
      const hh = String(h).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      const timeStr = `${hh}:${mm}`;

      return {
        timeStr,
        timeLabel: formatISTTime(timeStr),
        minutes: rp.minutes,
        value: rp.value,
        x: Math.round(getX(rp.minutes)),
        y: Math.round(getY(rp.value)),
        eventTitle,
        eventType,
        eventIcon,
        isRealEvent: Boolean(matchedEvent),
      };
    });

    // Spline curve generation
    let splineD = '';
    let areaD = '';

    if (points.length > 1) {
      splineD = `M ${points[0].x} ${points[0].y}`;
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i === 0 ? 0 : i - 1];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

        const tension = 0.25;
        const cp1x = p1.x + (p2.x - p0.x) * tension;
        const cp1y = p1.y + (p2.y - p0.y) * tension;
        const cp2x = p2.x - (p3.x - p1.x) * tension;
        const cp2y = p2.y - (p3.y - p1.y) * tension;

        splineD += ` C ${Math.round(cp1x)} ${Math.round(cp1y)}, ${Math.round(cp2x)} ${Math.round(cp2y)}, ${p2.x} ${p2.y}`;
      }
      areaD = `${splineD} L ${points[points.length - 1].x} 135 L ${points[0].x} 135 Z`;
    }

    // Stats
    let peak = points[0] || null;
    let lowest = points[0] || null;
    let inRangeCount = 0;

    points.forEach((p) => {
      if (!peak || p.value > peak.value) peak = p;
      if (!lowest || p.value < lowest.value) lowest = p;
      if (p.value >= 70 && p.value <= 140) inRangeCount++;
    });

    const inRangePct = points.length > 0 ? Math.round((inRangeCount / points.length) * 100) : 0;

    return {
      chartData: points,
      splinePath: splineD,
      areaPath: areaD,
      peakPoint: peak,
      lowestPoint: lowest,
      timeInRangePct: inRangePct,
      landmarkEvents: sortedLogs,
    };
  }, [logs]);

  // If no logs exist for this date
  if (!logs || logs.length === 0) {
    return (
      <div className="bg-surface-container-low/80 backdrop-blur-2xl p-5 md:p-6 rounded-3xl border border-white/5 shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between pb-2">
          <span className="font-headline-sm text-sm text-on-surface font-bold">Day Rhythm Curve</span>
          <span className="px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-md text-[0.7rem] border border-white/5">
            Felt Energy vs Glycemia
          </span>
        </div>
        <p className="font-label-md text-xs text-on-surface-variant pb-6">
          Continuous subjective wellbeing curve synthesized across check-ins and meal timing.
        </p>

        <div className="h-40 flex flex-col items-center justify-center border border-dashed border-outline/20 rounded-2xl p-4 text-center">
          <span className="material-symbols-outlined text-outline/50 text-3xl mb-2">timeline</span>
          <span className="text-xs font-semibold text-on-surface-variant">No logs recorded for this day</span>
          <p className="text-[0.7rem] text-outline mt-1 max-w-[240px]">
            Log your meals, insulin, or feel check-ins to synthesize your continuous glycemic rhythm.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-low/80 backdrop-blur-2xl p-5 md:p-6 rounded-3xl border border-white/5 shadow-xl relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-2">
          <span className="font-headline-sm text-sm text-on-surface font-bold">Day Rhythm Curve</span>
          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono text-[0.65rem] font-bold border border-primary/20">
            {logs.length} {logs.length === 1 ? 'event' : 'events'}
          </span>
        </div>
        <span className="px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-md text-[0.7rem] border border-white/5">
          {timeInRangePct}% in Comfort Zone
        </span>
      </div>

      <p className="font-label-md text-xs text-on-surface-variant pb-3">
        Continuous glycemic &amp; energy curve synthesized from your actual logs today.
      </p>

      {/* Dynamic Native SVG Curve (No external bundle/memory overhead) */}
      <div className="w-full h-40 relative">
        <svg
          className="w-full h-full overflow-visible"
          fill="none"
          preserveAspectRatio="none"
          viewBox="0 0 360 140"
        >
          <defs>
            <linearGradient id="dayRhythmCurveGrad" x1="0%" x2="0%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="#4edea3" stopOpacity={0.4} />
              <stop offset="50%" stopColor="#ffb95f" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#4cd7f6" stopOpacity={0.0} />
            </linearGradient>
          </defs>

          {/* Target Comfort Zone Fill (70 - 140 mg/dL) */}
          <rect fill="#4edea3" fillOpacity={0.05} height={44} rx={6} width={360} x={0} y={72} />
          <line stroke="#ffb95f" strokeDasharray="3 3" strokeOpacity={0.35} x1={0} x2={360} y1={72} y2={72} />
          <line stroke="#3c4a42" strokeDasharray="3 3" strokeOpacity={0.35} x1={0} x2={360} y1={116} y2={116} />

          {/* Area under curve */}
          {areaPath && <path d={areaPath} fill="url(#dayRhythmCurveGrad)" />}

          {/* Spline curve line */}
          {splinePath && (
            <path
              d={splinePath}
              stroke="#4edea3"
              strokeLinecap="round"
              strokeWidth={2.8}
            />
          )}

          {/* Event Dots */}
          {chartData.map((p) => {
            if (!p.isRealEvent) return null;

            const dotColor =
              p.eventType === 'insulin'
                ? '#4cd7f6'
                : p.eventType === 'food'
                ? '#ffb95f'
                : p.eventType === 'activity'
                ? '#4edea3'
                : p.eventType === 'feel'
                ? '#ffb4ab'
                : '#ffffff';

            const isHovered = activePoint?.minutes === p.minutes;

            return (
              <g
                key={`dot-${p.minutes}`}
                className="cursor-pointer"
                onMouseEnter={() => setActivePoint(p)}
                onMouseLeave={() => setActivePoint(null)}
                onClick={() => setActivePoint(activePoint?.minutes === p.minutes ? null : p)}
              >
                <circle cx={p.x} cy={p.y} r={8} fill="transparent" />
                <circle
                  cx={p.x}
                  cy={p.y}
                  fill={dotColor}
                  r={isHovered ? 5.5 : 4}
                  stroke="#0b1326"
                  strokeWidth={2}
                  className="transition-all duration-200"
                />
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip */}
        {activePoint && (
          <div
            className="absolute z-20 pointer-events-none -top-12 transform -translate-x-1/2 bg-surface-container-high/95 backdrop-blur-xl px-3 py-1.5 rounded-xl border border-white/10 shadow-2xl text-xs space-y-0.5 whitespace-nowrap"
            style={{
              left: `${(activePoint.x / 360) * 100}%`,
            }}
          >
            <div className="flex items-center gap-2 font-mono text-[0.7rem] text-on-surface-variant font-bold">
              <span>{activePoint.timeLabel}</span>
              <span className={activePoint.value > 140 ? 'text-tertiary' : activePoint.value < 70 ? 'text-error' : 'text-primary'}>
                ~{activePoint.value} mg/dL
              </span>
            </div>
            {activePoint.eventTitle && (
              <div className="text-[0.65rem] text-secondary truncate max-w-[200px]">
                {activePoint.eventTitle}
              </div>
            )}
          </div>
        )}
      </div>

      {/* X-Axis Time Anchors */}
      <div className="flex justify-between text-[0.65rem] text-outline font-label-md mt-1 px-1">
        {chartData.length > 0 && (
          <>
            <span>{chartData[0]?.timeLabel}</span>
            <span>{chartData[Math.floor(chartData.length * 0.33)]?.timeLabel}</span>
            <span className="text-tertiary font-bold">{peakPoint?.timeLabel} (Peak)</span>
            <span>{chartData[chartData.length - 1]?.timeLabel}</span>
          </>
        )}
      </div>

      {/* Real Daily Peak & Low Badges */}
      <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-surface-container-high/40">
        <div className="p-2 rounded-xl bg-surface-container-lowest/60 border border-white/5 flex items-center gap-2">
          <span className="material-symbols-outlined text-tertiary text-base">north_east</span>
          <div>
            <div className="text-[0.65rem] text-on-surface-variant uppercase font-medium">Estimated Peak</div>
            <div className="font-mono text-xs font-bold text-on-surface">
              {peakPoint ? `${peakPoint.timeLabel} (~${peakPoint.value})` : 'N/A'}
            </div>
          </div>
        </div>
        <div className="p-2 rounded-xl bg-surface-container-lowest/60 border border-white/5 flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary text-base">south_east</span>
          <div>
            <div className="text-[0.65rem] text-on-surface-variant uppercase font-medium">Lowest Dip</div>
            <div className="font-mono text-xs font-bold text-on-surface">
              {lowestPoint ? `${lowestPoint.timeLabel} (~${lowestPoint.value})` : 'N/A'}
            </div>
          </div>
        </div>
      </div>

      {/* Real Chronological Event Timeline Chips */}
      <div className="mt-3">
        <div className="text-[0.65rem] text-on-surface-variant uppercase font-bold tracking-wider mb-1.5">
          Logged Events Today ({landmarkEvents.length})
        </div>
        <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
          {landmarkEvents.map((evt) => {
            const timeFormatted = formatISTTime(evt.log_time);
            let badgeBg = 'bg-surface-container-high/80 text-on-surface-variant';
            let icon = 'event';
            let label = '';

            if (evt.category === 'insulin' && evt.insulin) {
              badgeBg = 'bg-secondary/15 text-secondary border border-secondary/20';
              icon = 'vaccines';
              label = `${evt.insulin.units}U ${evt.insulin.insulin_type === 'morning_regular' ? 'Morning Regular' : evt.insulin.insulin_type === 'night_30_70' ? '30/70 Mix' : 'Insulin'}`;
            } else if (evt.category === 'food' && evt.food) {
              badgeBg = 'bg-tertiary/15 text-tertiary border border-tertiary/20';
              icon = 'restaurant';
              label = `${evt.food.meal}: ${evt.food.items.slice(0, 18)}${evt.food.items.length > 18 ? '...' : ''}`;
            } else if (evt.category === 'feel' && evt.feel) {
              badgeBg =
                evt.feel.feel === 'low' || evt.feel.feel === 'slightly_low'
                  ? 'bg-error/15 text-error border border-error/20'
                  : 'bg-primary/15 text-primary border border-primary/20';
              icon = 'sentiment_satisfied';
              label = `Feel: ${evt.feel.feel.replace('_', ' ')}`;
            } else if (evt.category === 'activity' && evt.activity) {
              badgeBg = 'bg-primary/15 text-primary border border-primary/20';
              icon = 'directions_run';
              label = `${evt.activity.activity_type} (${evt.activity.duration_min}m)`;
            } else if (evt.category === 'glucose' && evt.glucose) {
              badgeBg = 'bg-white/10 text-white border border-white/20';
              icon = 'bloodtype';
              label = `${evt.glucose.reading_mgdl} mg/dL`;
            }

            return (
              <span
                key={evt.id}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.65rem] font-medium transition-all ${badgeBg}`}
              >
                <span className="material-symbols-outlined text-[11px]">{icon}</span>
                <span className="font-mono font-bold text-[0.6rem]">{timeFormatted}</span>
                <span>{label}</span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
