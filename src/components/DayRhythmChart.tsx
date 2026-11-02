'use client';

import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceArea,
  ReferenceLine,
} from 'recharts';
import { UnifiedLogItem } from '@/types';
import { timeToMinutes, minutesToTime, formatISTTime } from '@/lib/date-utils';

interface DayRhythmChartProps {
  logs: UnifiedLogItem[];
  selectedDate: string;
}

interface RhythmDataPoint {
  timeStr: string;
  timeLabel: string;
  minutes: number;
  value: number;
  eventTitle?: string;
  eventType?: 'insulin' | 'food' | 'feel' | 'activity' | 'glucose';
  eventIcon?: string;
  isRealEvent?: boolean;
}

export default function DayRhythmChart({ logs, selectedDate }: DayRhythmChartProps) {
  // Synthesize continuous physiological rhythm curve from real daily events
  const { chartData, peakPoint, lowestPoint, timeInRangePct, landmarkEvents } = useMemo(() => {
    if (!logs || logs.length === 0) {
      return {
        chartData: [] as RhythmDataPoint[],
        peakPoint: null,
        lowestPoint: null,
        timeInRangePct: 0,
        landmarkEvents: [] as UnifiedLogItem[],
      };
    }

    // Sort events chronologically
    const sortedLogs = [...logs].sort((a, b) => a.log_time.localeCompare(b.log_time));

    // Determine the time window for the chart (from earliest event to latest event + padding)
    const logMins = sortedLogs.map((l) => timeToMinutes(l.log_time));
    const minMins = Math.max(0, Math.min(...logMins) - 60);
    const maxMins = Math.min(1440, Math.max(...logMins) + 90);

    const startMins = Math.min(minMins, 360); // At least 06:00 AM
    const endMins = Math.max(maxMins, 1320); // At least 10:00 PM

    // Generate continuous curve sampled every 30 minutes
    const points: RhythmDataPoint[] = [];

    for (let m = startMins; m <= endMins; m += 30) {
      // 1. Baseline resting glycemia / felt energy index
      let val = 100;

      // 2. Direct Anchor: Feel check-ins or Glucose readings within 35 mins
      sortedLogs.forEach((l) => {
        const itemMins = timeToMinutes(l.log_time);
        const diff = Math.abs(m - itemMins);

        if (diff <= 35) {
          const weight = Math.max(0, 1 - diff / 35);
          if (l.category === 'glucose' && l.glucose) {
            val = val * (1 - weight) + l.glucose.reading_mgdl * weight;
          } else if (l.category === 'feel' && l.feel) {
            const feelTargets: Record<string, number> = {
              low: 65,
              slightly_low: 78,
              okay: 102,
              slightly_high: 148,
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
            // Determine carb peak height
            let carbPeak = 35;
            if (l.food.carb_size === 'large') carbPeak = 55;
            else if (l.food.carb_size === 'small') carbPeak = 20;
            if (l.food.carbs_g && l.food.carbs_g > 0) {
              carbPeak = Math.min(65, Math.max(20, l.food.carbs_g * 0.45));
            }
            // Natural rise and decay bell curve
            const wave = Math.sin((Math.PI * dt) / 180);
            val += carbPeak * wave;
          }
        }
      });

      // 4. Insulin action curve (promotes return to baseline / downward slope over 3–4 hours)
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

      // 5. Activity / Exertion sensitivity effect
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

      // Clamp physiologically between 55 and 230
      const clampedVal = Math.round(Math.max(55, Math.min(230, val)));

      // Check if a real event happened at/near this minute slot
      const matchedEvent = sortedLogs.find((evt) => Math.abs(timeToMinutes(evt.log_time) - m) <= 15);

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

      const rawTime = minutesToTime(m);
      points.push({
        timeStr: rawTime,
        timeLabel: formatISTTime(rawTime),
        minutes: m,
        value: clampedVal,
        eventTitle,
        eventType,
        eventIcon,
        isRealEvent: Boolean(matchedEvent),
      });
    }

    // Statistics
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

      {/* Dynamic Recharts Curve */}
      <div className="w-full h-44 relative -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
            <defs>
              <linearGradient id="dayRhythmGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4edea3" stopOpacity={0.45} />
                <stop offset="50%" stopColor="#ffb95f" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#4cd7f6" stopOpacity={0.05} />
              </linearGradient>
            </defs>

            {/* Target In-Range Comfort Band (70 - 140 mg/dL equiv) */}
            <ReferenceArea
              y1={70}
              y2={140}
              fill="#4edea3"
              fillOpacity={0.06}
              strokeOpacity={0.15}
            />
            <ReferenceLine y={140} stroke="#ffb95f" strokeDasharray="3 3" strokeOpacity={0.4} />
            <ReferenceLine y={70} stroke="#ffb4ab" strokeDasharray="3 3" strokeOpacity={0.4} />

            <XAxis
              dataKey="timeLabel"
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#737785', fontSize: 10 }}
              interval="preserveStartEnd"
              minTickGap={35}
            />
            <YAxis
              domain={[50, 220]}
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#737785', fontSize: 10 }}
              ticks={[70, 100, 140, 190]}
            />

            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload as RhythmDataPoint;
                  const isHigh = data.value > 140;
                  const isLow = data.value < 70;
                  const statusColor = isHigh ? 'text-tertiary' : isLow ? 'text-error' : 'text-primary';
                  const statusLabel = isHigh ? 'Elevated Wave' : isLow ? 'Low Dip' : 'Target Comfort Zone';

                  return (
                    <div className="bg-surface-container-high/95 backdrop-blur-xl p-2.5 rounded-xl border border-white/10 shadow-2xl text-xs space-y-1">
                      <div className="flex items-center justify-between gap-4 font-mono text-[0.7rem] text-on-surface-variant">
                        <span>{data.timeLabel}</span>
                        <span className={`font-bold ${statusColor}`}>{statusLabel}</span>
                      </div>
                      <div className="font-label-numeric text-base font-bold text-on-surface">
                        ~{data.value} <span className="text-[0.65rem] font-normal text-outline">equiv. mg/dL</span>
                      </div>
                      {data.eventTitle && (
                        <div className="pt-1 border-t border-white/10 flex items-center gap-1.5 text-secondary font-medium text-[0.7rem]">
                          <span className="material-symbols-outlined text-[13px]">{data.eventIcon || 'info'}</span>
                          <span>{data.eventTitle}</span>
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />

            <Area
              type="monotone"
              dataKey="value"
              stroke="#4edea3"
              strokeWidth={2.5}
              fill="url(#dayRhythmGradient)"
              activeDot={{ r: 5, fill: '#4edea3', stroke: '#0b1326', strokeWidth: 2 }}
              dot={(props) => {
                const { cx, cy, payload } = props as { cx: number; cy: number; payload: RhythmDataPoint };
                if (payload.isRealEvent) {
                  const dotColor =
                    payload.eventType === 'insulin'
                      ? '#4cd7f6'
                      : payload.eventType === 'food'
                      ? '#ffb95f'
                      : payload.eventType === 'activity'
                      ? '#4edea3'
                      : payload.eventType === 'feel'
                      ? '#ffb4ab'
                      : '#ffffff';

                  return (
                    <circle
                      key={`dot-${payload.minutes}`}
                      cx={cx}
                      cy={cy}
                      r={4.5}
                      fill={dotColor}
                      stroke="#0b1326"
                      strokeWidth={2}
                    />
                  );
                }
                return <React.Fragment key={`empty-${props.index}`} />;
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Real Daily Peak & Low Badges */}
      <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-surface-container-high/40">
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
