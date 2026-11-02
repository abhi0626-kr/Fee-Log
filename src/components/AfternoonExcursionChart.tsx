'use client';

import React, { useMemo, useState } from 'react';
import { FeelLog, FoodLog, GlucoseLog, InsulinLog } from '@/types';
import { filterLogsByDateWindow } from '@/lib/patterns';
import { timeToMinutes } from '@/lib/date-utils';

interface AfternoonExcursionChartProps {
  feelLogs: FeelLog[];
  foodLogs: FoodLog[];
  glucoseLogs: GlucoseLog[];
  insulinLogs: InsulinLog[];
  windowDays: number;
}

interface HourlySlot {
  hour: number;
  label: string;
  isAfternoonCore: boolean;
  intensity: number; // 0 to 100
  eventCount: number;
  feelCount: number;
  highFeelCount: number;
  mealCount: number;
  glucoseSpikeCount: number;
  insulinCount: number;
  eventsSummary: string[];
  x: number;
  y: number;
  barHeight: number;
  cx: number;
  cy: number;
  fillColor: string;
  fillOpacity: number;
}

export default function AfternoonExcursionChart({
  feelLogs,
  foodLogs,
  glucoseLogs,
  insulinLogs,
  windowDays,
}: AfternoonExcursionChartProps) {
  const [activeSlot, setActiveSlot] = useState<HourlySlot | null>(null);

  // Compute live hourly distribution
  const { slots, peakSlot, hasRealData } = useMemo(() => {
    const windowFeels = filterLogsByDateWindow(feelLogs, windowDays);
    const windowFoods = filterLogsByDateWindow(foodLogs, windowDays);
    const windowGlucoses = filterLogsByDateWindow(glucoseLogs, windowDays);
    const windowInsulins = filterLogsByDateWindow(insulinLogs, windowDays);

    const hours = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
    const totalLogsInWindow =
      windowFeels.length + windowFoods.length + windowGlucoses.length + windowInsulins.length;

    // Check if we have real logs in the system
    const hasData = totalLogsInWindow > 0;

    // Calculate score per hour
    const rawHourlyData = hours.map((hour, idx) => {
      const hourStartMin = hour * 60;
      const hourEndMin = (hour + 1) * 60;

      let score = 0;
      const eventsSummary: string[] = [];
      let feelCount = 0;
      let highFeelCount = 0;
      let mealCount = 0;
      let glucoseSpikeCount = 0;
      let insulinCount = 0;

      // 1. Feel Check-ins in this hour
      windowFeels.forEach((f) => {
        const mins = timeToMinutes(f.log_time);
        if (mins >= hourStartMin && mins < hourEndMin) {
          feelCount++;
          if (f.feel === 'high') {
            score += 35;
            highFeelCount++;
            eventsSummary.push(`Felt High at ${f.log_time}${f.symptoms?.length ? ` (${f.symptoms.join(', ')})` : ''}`);
          } else if (f.feel === 'slightly_high') {
            score += 24;
            highFeelCount++;
            eventsSummary.push(`Felt Slightly High at ${f.log_time}`);
          } else if (f.feel === 'low' || f.feel === 'slightly_low') {
            score += 20;
            eventsSummary.push(`Felt ${f.feel.replace('_', ' ')} at ${f.log_time}`);
          } else {
            score += 5;
            eventsSummary.push(`Felt Okay at ${f.log_time}`);
          }
        }
      });

      // 2. Meal Excursions
      // Lunches or snacks logged between 12:00 and 15:30 project their peak glycemic load 2 to 4 hours later
      windowFoods.forEach((food) => {
        const mealMins = timeToMinutes(food.log_time);
        const diffMins = hourStartMin + 30 - mealMins;

        // Direct meal event in this exact hour
        if (mealMins >= hourStartMin && mealMins < hourEndMin) {
          mealCount++;
          score += 15;
          eventsSummary.push(`${food.meal.toUpperCase()}: ${food.items}`);
        }

        // Post-meal excursion wave (peaks between 90 - 210 mins post meal)
        if (food.meal === 'lunch' || food.meal === 'snack') {
          if (diffMins >= 60 && diffMins <= 300) {
            // Bell curve peaking around 150 mins (2.5h) post-lunch
            const peakCenter = 150;
            const dist = Math.abs(diffMins - peakCenter);
            const wave = Math.max(0, 1 - dist / 150);

            let carbWeight = 22;
            if (food.carb_size === 'large' || (food.carbs_g && food.carbs_g > 80)) carbWeight = 36;
            else if (food.carb_size === 'small') carbWeight = 12;

            score += carbWeight * wave;
          }
        }
      });

      // 3. Glucose Readings in this hour
      windowGlucoses.forEach((g) => {
        const mins = timeToMinutes(g.log_time);
        if (mins >= hourStartMin && mins < hourEndMin) {
          if (g.reading_mgdl > 140) {
            glucoseSpikeCount++;
            score += Math.min(45, (g.reading_mgdl - 140) * 0.7);
            eventsSummary.push(`Meter: ${g.reading_mgdl} mg/dL at ${g.log_time}`);
          } else if (g.reading_mgdl < 70) {
            score += 25;
            eventsSummary.push(`Meter Low: ${g.reading_mgdl} mg/dL at ${g.log_time}`);
          } else {
            eventsSummary.push(`Meter: ${g.reading_mgdl} mg/dL at ${g.log_time}`);
          }
        }
      });

      // 4. Insulin regular doses (provide downward stabilization)
      windowInsulins.forEach((ins) => {
        const mins = timeToMinutes(ins.log_time);
        if (mins >= hourStartMin && mins < hourEndMin) {
          insulinCount++;
          eventsSummary.push(`${ins.units}U ${ins.insulin_type.replace('_', ' ')}`);
        }
      });

      // Hour label
      const hour12 = hour > 12 ? hour - 12 : hour;
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const label = `${hour12} ${ampm}`;
      const isAfternoonCore = hour >= 15 && hour <= 18;

      return {
        hour,
        label,
        isAfternoonCore,
        rawScore: score,
        eventCount: feelCount + mealCount + glucoseSpikeCount + insulinCount,
        feelCount,
        highFeelCount,
        mealCount,
        glucoseSpikeCount,
        insulinCount,
        eventsSummary,
        idx,
      };
    });

    // Determine max score for normalization
    const maxRawScore = Math.max(...rawHourlyData.map((d) => d.rawScore));

    // Normalize intensity 0..100
    // If no data exists yet, provide clinical baseline shape reflecting typical Koramangala PG routine
    const computedSlots: HourlySlot[] = rawHourlyData.map((d) => {
      let intensity = 0;

      if (hasData && maxRawScore > 0) {
        // Real normalized intensity
        intensity = Math.round((d.rawScore / maxRawScore) * 100);
      } else {
        // Clinical baseline default curve
        const baselineCurve: Record<number, number> = {
          12: 15,
          13: 28,
          14: 45,
          15: 86,
          16: 95,
          17: 90,
          18: 72,
          19: 45,
          20: 25,
          21: 18,
          22: 12,
        };
        intensity = baselineCurve[d.hour] || 20;
      }

      // Height between 18px and 96px
      const barHeight = Math.max(16, Math.min(96, Math.round(18 + (intensity / 100) * 78)));
      const x = 30 + d.idx * 55;
      const y = 114 - barHeight;
      const cx = x + 14;
      const cy = y;

      // Color scheme matching design
      let fillColor = '#171f33';
      let fillOpacity = 1.0;

      if (intensity >= 75) {
        fillColor = '#ffb95f';
        fillOpacity = 0.95;
      } else if (intensity >= 50) {
        fillColor = '#ffb95f';
        fillOpacity = 0.75;
      } else if (intensity >= 30) {
        fillColor = '#4edea3';
        fillOpacity = 0.35;
      } else if (intensity >= 20) {
        fillColor = '#222a3d';
        fillOpacity = 1.0;
      } else {
        fillColor = '#171f33';
        fillOpacity = 1.0;
      }

      return {
        hour: d.hour,
        label: d.label,
        isAfternoonCore: d.isAfternoonCore,
        intensity,
        eventCount: d.eventCount,
        feelCount: d.feelCount,
        highFeelCount: d.highFeelCount,
        mealCount: d.mealCount,
        glucoseSpikeCount: d.glucoseSpikeCount,
        insulinCount: d.insulinCount,
        eventsSummary: d.eventsSummary,
        x,
        y,
        barHeight,
        cx,
        cy,
        fillColor,
        fillOpacity,
      };
    });

    // Find the peak slot
    let peak = computedSlots[0];
    computedSlots.forEach((slot) => {
      if (slot.intensity > peak.intensity) {
        peak = slot;
      }
    });

    return {
      slots: computedSlots,
      peakSlot: peak,
      hasRealData: hasData,
      peakHourLabel: peak.label,
    };
  }, [feelLogs, foodLogs, glucoseLogs, insulinLogs, windowDays]);

  // Construct smooth cubic Bezier spline path across the tops of the bars
  const splinePath = useMemo(() => {
    if (slots.length < 2) return '';

    // Points array: each slot's (cx, cy)
    const points = slots.map((s) => ({ x: s.cx, y: s.cy }));

    // Start at first point
    let d = `M ${points[0].x} ${points[0].y}`;

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

      // Catmull-Rom to cubic Bezier control points
      const tension = 0.3;
      const cp1x = p1.x + (p2.x - p0.x) * tension;
      const cp1y = p1.y + (p2.y - p0.y) * tension;
      const cp2x = p2.x - (p3.x - p1.x) * tension;
      const cp2y = p2.y - (p3.y - p1.y) * tension;

      d += ` C ${Math.round(cp1x)} ${Math.round(cp1y)}, ${Math.round(cp2x)} ${Math.round(cp2y)}, ${p2.x} ${p2.y}`;
    }

    return d;
  }, [slots]);

  return (
    <div className="relative w-full">
      {/* Header Info */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-label-md text-xs text-on-surface-variant">Relative Symptom Intensity Profile</span>
          {hasRealData && (
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono text-[0.65rem] font-bold border border-primary/20">
              Live Telemetry
            </span>
          )}
        </div>
        <span className="font-label-md text-xs text-primary font-medium">
          Post-Bolus Interval (Hrs 2–5)
        </span>
      </div>

      {/* SVG Container */}
      <div className="relative w-full h-36">
        <svg
          className="w-full h-full overflow-visible"
          fill="none"
          preserveAspectRatio="none"
          viewBox="0 0 620 140"
        >
          {/* Guide lines */}
          <line stroke="#3c4a42" strokeDasharray="4 4" strokeOpacity="0.3" x1="20" x2="600" y1="110" y2="110" />
          <line stroke="#3c4a42" strokeDasharray="4 4" strokeOpacity="0.2" x1="20" x2="600" y1="65" y2="65" />

          {/* Interactive Hourly Bars */}
          {slots.map((slot) => {
            const isHovered = activeSlot?.hour === slot.hour;
            const isPeak = peakSlot?.hour === slot.hour;

            return (
              <g
                key={`slot-${slot.hour}`}
                className="cursor-pointer transition-opacity duration-200"
                onMouseEnter={() => setActiveSlot(slot)}
                onMouseLeave={() => setActiveSlot(null)}
                onClick={() => setActiveSlot(activeSlot?.hour === slot.hour ? null : slot)}
              >
                {/* Hit area */}
                <rect
                  x={slot.x - 5}
                  y={10}
                  width={38}
                  height={110}
                  fill="transparent"
                />

                {/* Visible rounded bar */}
                <rect
                  x={slot.x}
                  y={slot.y}
                  width="28"
                  height={slot.barHeight}
                  rx="6"
                  fill={slot.fillColor}
                  fillOpacity={isHovered ? 1 : slot.fillOpacity}
                  stroke={isHovered || isPeak ? '#ffddb8' : 'none'}
                  strokeWidth={isHovered ? 2 : isPeak ? 1 : 0}
                  className="transition-all duration-300"
                />
              </g>
            );
          })}

          {/* Smooth Dynamic Spline Overlay */}
          {splinePath && (
            <path
              d={splinePath}
              fill="none"
              opacity="0.85"
              stroke="#ffb95f"
              strokeLinecap="round"
              strokeWidth="2.5"
            />
          )}

          {/* Dynamic Peak Load Indicator */}
          {peakSlot && (
            <g className="transition-all duration-500">
              <circle
                cx={peakSlot.cx}
                cy={peakSlot.cy}
                r="4.5"
                fill="#ffddb8"
                stroke="#0b1326"
                strokeWidth="1.5"
              />
              <circle
                cx={peakSlot.cx}
                cy={peakSlot.cy}
                r="8"
                fill="#ffb95f"
                fillOpacity="0.25"
                className="animate-ping"
              />
              <text
                fill="#ffddb8"
                fontFamily="'Plus Jakarta Sans', sans-serif"
                fontSize="10"
                fontWeight="700"
                textAnchor="middle"
                x={peakSlot.cx}
                y={Math.max(12, peakSlot.cy - 10)}
              >
                Peak Load ({peakSlot.label})
              </text>
            </g>
          )}
        </svg>

        {/* Floating Tooltip upon slot hover/click */}
        {activeSlot && (
          <div
            className="absolute z-20 pointer-events-none -top-12 transform -translate-x-1/2 bg-surface-container-high/95 backdrop-blur-xl px-3 py-1.5 rounded-xl border border-white/10 shadow-2xl text-xs space-y-0.5 whitespace-nowrap"
            style={{
              left: `${(activeSlot.cx / 620) * 100}%`,
            }}
          >
            <div className="flex items-center gap-2 font-mono text-[0.7rem] text-on-surface-variant font-bold">
              <span>{activeSlot.label}</span>
              <span className={activeSlot.intensity > 60 ? 'text-tertiary' : 'text-primary'}>
                {activeSlot.intensity}% Intensity
              </span>
            </div>
            {activeSlot.eventsSummary.length > 0 ? (
              <div className="text-[0.65rem] text-on-surface truncate max-w-[200px]">
                {activeSlot.eventsSummary[0]}
                {activeSlot.eventsSummary.length > 1 && ` (+${activeSlot.eventsSummary.length - 1} more)`}
              </div>
            ) : (
              <div className="text-[0.65rem] text-outline">No direct events logged in this hour</div>
            )}
          </div>
        )}
      </div>

      {/* Timeline X-Axis labels */}
      <div className="flex justify-between px-2 font-label-md text-xs text-on-surface-variant font-medium mt-1">
        {slots.map((s) => {
          const isCore = s.isAfternoonCore;
          const isPeak = peakSlot?.hour === s.hour;

          return (
            <span
              key={`label-${s.hour}`}
              className={`transition-colors cursor-pointer ${
                isPeak
                  ? 'text-tertiary font-bold underline decoration-tertiary/40 underline-offset-4'
                  : isCore
                  ? 'text-tertiary font-bold'
                  : 'text-on-surface-variant'
              }`}
              onClick={() => setActiveSlot(activeSlot?.hour === s.hour ? null : s)}
            >
              {s.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
