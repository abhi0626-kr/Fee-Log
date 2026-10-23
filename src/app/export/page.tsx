'use client';

import React, { useState, useEffect } from 'react';
import {
  getTodayIST,
  formatISTDate,
  shiftDate,
} from '@/lib/date-utils';
import {
  getUnifiedLogsForDate,
  getSettings,
  saveSettings,
  getAllLoggedDates,
  DEFAULT_SETTINGS,
  seedRealisticPGData,
  flushOfflineQueue,
} from '@/lib/sync-storage';
import {
  generateCSV,
  downloadCSVFile,
  generateDoctorPDF,
} from '@/lib/export-utils';
import { UnifiedLogItem, UserSettings } from '@/types';

export default function ExportPage() {
  const [today] = useState<string>(getTodayIST());
  const [startDate, setStartDate] = useState<string>(shiftDate(getTodayIST(), -13));
  const [endDate, setEndDate] = useState<string>(getTodayIST());
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [selectedLogs, setSelectedLogs] = useState<UnifiedLogItem[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  // Preference toggles
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(true);
  const [isEditingUnits, setIsEditingUnits] = useState(false);
  const [morningUnitsInput, setMorningUnitsInput] = useState(20);
  const [afternoonUnitsInput, setAfternoonUnitsInput] = useState(10);
  const [nightUnitsInput, setNightUnitsInput] = useState(25);

  useEffect(() => {
    const curSettings = getSettings();
    setSettings(curSettings);
    setMorningUnitsInput(curSettings.morning_regular_units);
    setAfternoonUnitsInput(curSettings.afternoon_regular_units ?? 10);
    setNightUnitsInput(curSettings.night_30_70_units);

    // Collect all unified logs between startDate and endDate
    const allDates = getAllLoggedDates().filter((d) => d >= startDate && d <= endDate);
    const combined: UnifiedLogItem[] = [];

    allDates.forEach((d) => {
      const dayLogs = getUnifiedLogsForDate(d);
      combined.push(...dayLogs);
    });

    combined.sort((a, b) => {
      if (a.log_date === b.log_date) {
        return a.log_time.localeCompare(b.log_time);
      }
      return a.log_date.localeCompare(b.log_date);
    });

    setSelectedLogs(combined);
  }, [startDate, endDate]);

  const handleDownloadCSV = () => {
    setIsExporting(true);
    try {
      const csvData = generateCSV(selectedLogs);
      downloadCSVFile(csvData, `Feelog_T1D_Report_${startDate}_to_${endDate}.csv`);
      setExportSuccess('Raw CSV exported successfully');
      setTimeout(() => setExportSuccess(null), 3500);
    } catch (e) {
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadPDF = () => {
    setIsExporting(true);
    try {
      generateDoctorPDF(selectedLogs, settings, startDate, endDate);
      setExportSuccess('Physician Consultation PDF generated!');
      setTimeout(() => setExportSuccess(null), 3500);
    } catch (e) {
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveUnits = () => {
    const updated = {
      ...settings,
      morning_regular_units: Number(morningUnitsInput),
      afternoon_regular_units: Number(afternoonUnitsInput),
      night_30_70_units: Number(nightUnitsInput),
    };
    saveSettings(updated);
    setSettings(updated);
    setIsEditingUnits(false);
    setExportSuccess('Prescribed regimen units updated');
    setTimeout(() => setExportSuccess(null), 3000);
  };

  const handlePreset = (days: number) => {
    setStartDate(shiftDate(today, -(days - 1)));
    setEndDate(today);
  };

  // Derive metrics for preview
  const feelLogs = selectedLogs.filter((l) => l.category === 'feel');
  const activityLogs = selectedLogs.filter((l) => l.category === 'activity');
  const fogEvents = feelLogs.filter((f) => f.feel?.feel === 'slightly_high' || f.feel?.feel === 'high').length;
  const uniqueDays = new Set(selectedLogs.map((l) => l.log_date)).size;

  return (
    <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-6">
      {/* Header Accents & Context Meta */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pt-2">
        <div>
          <div className="flex items-center gap-2 text-secondary font-label-md text-xs uppercase tracking-wider mb-1 font-bold">
            <span className="material-symbols-outlined text-[1rem]">clinical_notes</span>
            <span>Doctor Communication &amp; Archival</span>
          </div>
          <h1 className="font-headline-xl text-2xl md:text-3xl text-on-surface font-extrabold tracking-tight">
            Clinical Export &amp; Profile
          </h1>
          <p className="font-body-md text-sm text-on-surface-variant mt-1 max-w-xl">
            Generate structured, clinical-grade telemetry summaries formatted for your consulting endocrinologist in Bangalore or Tamil Nadu.
          </p>
        </div>

        {/* Quick Sync Status Capsule */}
        <div className="flex items-center gap-2 self-start lg:self-auto px-4 py-1.5 rounded-full bg-surface-container-high/60 border border-white/5 backdrop-blur-md shadow-sm">
          <div className="w-2 h-2 rounded-full bg-primary animate-ping"></div>
          <span className="font-label-md text-xs text-on-surface-variant">Cloud Sync: Encrypted &amp; Ready</span>
          <span className="text-outline font-label-md text-xs">·</span>
          <span className="font-label-md text-xs text-on-surface font-bold">
            {startDate} to {endDate}
          </span>
        </div>
      </div>

      {exportSuccess && (
        <div className="p-3 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-semibold text-center animate-in fade-in">
          {exportSuccess}
        </div>
      )}

      {/* Bento Grid Primary Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): Clinical Document Generation & Live Preview */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Export Control Hub */}
          <div className="relative overflow-hidden rounded-3xl bg-surface-container/70 border border-white/5 backdrop-blur-2xl p-6 shadow-xl">
            <div className="absolute -right-20 -top-20 w-64 h-64 bg-primary/10 rounded-full blur-[80px] pointer-events-none"></div>
            <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-secondary/10 rounded-full blur-[70px] pointer-events-none"></div>

            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-5 border-b border-surface-container-high/40">
              <div>
                <div className="flex items-center gap-1.5 text-primary font-label-md text-xs font-bold uppercase tracking-wider mb-1">
                  <span className="material-symbols-outlined text-[1rem]">picture_as_pdf</span>
                  <span>Physician-Ready Document</span>
                </div>
                <h2 className="font-headline-sm text-lg text-on-surface font-bold">
                  Endocrinology Consultation Brief
                </h2>
                <p className="font-body-md text-xs text-on-surface-variant mt-0.5">
                  Condensed 30-day symptom frequency, exercise impact, and prescribed basal rhythm.
                </p>
              </div>

              {/* Direct Download Actions */}
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full md:w-auto">
                <button
                  onClick={handleDownloadPDF}
                  disabled={isExporting}
                  type="button"
                  className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-primary-container text-on-primary font-body-md text-xs font-bold shadow-lg shadow-primary-container/25 hover:bg-primary active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-[1.125rem]">download</span>
                  <span>Download PDF</span>
                </button>
                <button
                  onClick={handleDownloadCSV}
                  disabled={isExporting}
                  type="button"
                  className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-surface-container-high/90 text-on-surface font-body-md text-xs font-semibold hover:bg-surface-bright active:scale-95 transition-all border border-white/5"
                >
                  <span className="material-symbols-outlined text-[1.125rem] text-secondary">table_view</span>
                  <span>Raw CSV</span>
                </button>
              </div>
            </div>

            {/* Range Presets Bar */}
            <div className="relative z-10 pt-4 flex flex-wrap items-center justify-between gap-2 text-on-surface-variant font-label-md text-xs">
              <div className="flex items-center gap-2">
                <span className="text-on-surface font-medium">Range:</span>
                <button
                  onClick={() => handlePreset(7)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                    startDate === shiftDate(today, -6) ? 'bg-primary text-on-primary font-bold' : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                  }`}
                  type="button"
                >
                  7 Days
                </button>
                <button
                  onClick={() => handlePreset(14)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                    startDate === shiftDate(today, -13) ? 'bg-primary text-on-primary font-bold' : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                  }`}
                  type="button"
                >
                  14 Days
                </button>
                <button
                  onClick={() => handlePreset(30)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                    startDate === shiftDate(today, -29) ? 'bg-primary text-on-primary font-bold' : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                  }`}
                  type="button"
                >
                  30 Days
                </button>
              </div>
              <span className="font-mono text-[0.7rem] text-outline">HASH: #FL-2026-BLR-098</span>
            </div>
          </div>

          {/* Live Clinical Document Preview Paper Card */}
          <div className="relative rounded-3xl bg-surface-container-lowest/90 border border-white/5 backdrop-blur-3xl p-6 shadow-2xl overflow-hidden">
            {/* Visual watermarks and stamp */}
            <div className="flex items-start justify-between pb-5 border-b border-surface-container-high/40">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-headline-sm text-lg text-on-surface font-extrabold tracking-tight">FEELOG</span>
                  <span className="text-outline font-label-md text-xs">/ CLINICAL METABOLIC TRANSCRIPT</span>
                </div>
                <div className="font-label-md text-[0.7rem] text-on-surface-variant uppercase tracking-widest">
                  Bangalore Student PG Cohort · Symptom-First Diary
                </div>
              </div>
              <div className="text-right">
                <span className="px-3 py-1 rounded-full bg-primary/10 text-primary font-label-md text-xs font-bold uppercase border border-primary/20">
                  Physician Copy
                </span>
                <p className="font-label-md text-[0.7rem] text-outline mt-1">
                  Generated: {formatISTDate(today, { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>

            {/* Document Patient & Prescription Header Strip */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-2xl bg-surface-container-low/70 border border-white/5 my-5">
              <div className="space-y-1">
                <div className="font-label-md text-[0.68rem] text-outline uppercase font-semibold">Patient Information</div>
                <div className="font-body-md text-sm text-on-surface font-bold">
                  {settings.display_name} ({settings.gender || 'Male'}, {settings.age || 20} Yrs)
                </div>
                <div className="font-label-md text-xs text-on-surface-variant">Height: {settings.height_cm} cm · Weight: {settings.weight_kg} kg</div>
                <div className="font-label-md text-xs text-on-surface-variant">
                  Residential: {settings.residence_area ? `${settings.residence_area}, ` : ''}{settings.city || 'Bangalore'} · Native: {settings.native_location || 'Tamil Nadu'}
                </div>
              </div>
              <div className="space-y-1">
                <div className="font-label-md text-[0.68rem] text-outline uppercase font-semibold">Prescribed Regimen (Self-Logged)</div>
                <div className="font-body-md text-sm text-primary font-bold">
                  Morning: {settings.morning_insulin_brand || 'Regular (R)'} · {settings.morning_regular_units} Units
                </div>
                {settings.afternoon_regular_units ? (
                  <div className="font-body-md text-sm text-tertiary font-bold">
                    Midday: {settings.midday_insulin_brand || 'Regular (R)'} · {settings.afternoon_regular_units} Units (as needed)
                  </div>
                ) : null}
                <div className="font-body-md text-sm text-secondary font-bold">
                  Night: {settings.night_insulin_brand || '30/70 Biphasic'} · {settings.night_30_70_units} Units
                </div>
                <div className="font-label-md text-xs text-on-surface-variant">
                  Doctor: {settings.doctor_name || 'Dr. S. Ramanathan, MD'} {settings.clinic_name ? `(${settings.clinic_name})` : ''}
                </div>
              </div>
            </div>

            {/* 30-Day Synthesis Metrics (4 Pillars) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <div className="p-3.5 rounded-2xl bg-surface-container-high/40 border border-white/5 flex flex-col justify-between">
                <span className="font-label-md text-[0.68rem] text-outline uppercase">Tracking Density</span>
                <div className="my-1">
                  <span className="font-headline-xl text-2xl font-bold text-on-surface">{uniqueDays}</span>
                  <span className="font-body-md text-xs text-on-surface-variant ml-1">days</span>
                </div>
                <span className="font-label-md text-xs text-primary">{feelLogs.length} feelings</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-surface-container-high/40 border border-white/5 flex flex-col justify-between">
                <span className="font-label-md text-[0.68rem] text-outline uppercase">Cardio Load</span>
                <div className="my-1">
                  <span className="font-headline-xl text-2xl font-bold text-secondary">
                    {activityLogs.reduce((acc, a) => acc + (a.activity?.duration_min || 0), 0)}
                  </span>
                  <span className="font-body-md text-xs text-on-surface-variant ml-1">min</span>
                </div>
                <span className="font-label-md text-xs text-on-surface-variant">{activityLogs.length} sessions</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-surface-container-high/40 border border-white/5 flex flex-col justify-between">
                <span className="font-label-md text-[0.68rem] text-outline uppercase">Afternoon Fog</span>
                <div className="my-1">
                  <span className="font-headline-xl text-2xl font-bold text-tertiary">{fogEvents}</span>
                  <span className="font-body-md text-xs text-on-surface-variant ml-1">events</span>
                </div>
                <span className="font-label-md text-xs text-tertiary-fixed">Peak: 3 PM - 7 PM</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-surface-container-high/40 border border-white/5 flex flex-col justify-between">
                <span className="font-label-md text-[0.68rem] text-outline uppercase">Hypo Episodes</span>
                <div className="my-1">
                  <span className="font-headline-xl text-2xl font-bold text-primary">
                    {feelLogs.filter((f) => f.feel?.feel === 'low' || f.feel?.feel === 'slightly_low').length}
                  </span>
                  <span className="font-body-md text-xs text-on-surface-variant ml-1">low feels</span>
                </div>
                <span className="font-label-md text-xs text-on-surface-variant">Symptom Tracked</span>
              </div>
            </div>

            {/* Mini Visual Telemetry Curve */}
            <div className="p-4 rounded-2xl bg-surface-container-low/50 border border-white/5 mb-5">
              <div className="flex items-center justify-between mb-2 font-label-md text-xs text-on-surface-variant">
                <span>Aggregated Afternoon Energy / Glycemic Trend (30-Day Baseline)</span>
                <span className="text-tertiary font-bold">Consistent 4:30 PM Dips</span>
              </div>
              <div className="w-full h-16">
                <svg className="w-full h-full overflow-visible" fill="none" preserveAspectRatio="none" viewBox="0 0 700 64">
                  <defs>
                    <linearGradient id="gradientReport" x1="0%" x2="0%" y1="0%" y2="100%">
                      <stop offset="0%" stopColor="#4edea3" stopOpacity="0.25"></stop>
                      <stop offset="100%" stopColor="#4edea3" stopOpacity="0.0"></stop>
                    </linearGradient>
                  </defs>
                  <path d="M0,32 C60,20 120,44 180,36 C240,28 300,10 360,18 C420,26 480,56 540,50 C600,44 640,22 700,28 L700,64 L0,64 Z" fill="url(#gradientReport)"></path>
                  <path d="M0,32 C60,20 120,44 180,36 C240,28 300,10 360,18 C420,26 480,56 540,50 C600,44 640,22 700,28" stroke="#4edea3" strokeLinecap="round" strokeWidth="2.5"></path>
                  <circle cx="360" cy="18" fill="#4edea3" r="4"></circle>
                  <circle cx="540" cy="50" fill="#ffb95f" r="4"></circle>
                </svg>
              </div>
              <div className="flex justify-between font-label-md text-[0.65rem] text-outline mt-1 uppercase tracking-wider">
                <span>07:00 AM (Pre-Run)</span>
                <span>12:30 PM (PG Mess Lunch)</span>
                <span className="text-tertiary font-bold">04:30 PM (Symptom Peak)</span>
                <span>08:30 PM (Biphasic Dose)</span>
                <span>11:30 PM (Sleep)</span>
              </div>
            </div>

            {/* Clinical Symptom Log Snippet Table */}
            <div className="overflow-x-auto">
              <div className="font-label-md text-xs text-outline uppercase mb-2 font-bold">Recent Log Excerpts</div>
              <table className="w-full text-left font-body-md text-xs">
                <thead>
                  <tr className="text-outline font-label-md text-[0.68rem] uppercase bg-surface-container-high/30">
                    <th className="py-2 px-3 rounded-l">Timestamp</th>
                    <th className="py-2 px-3">Meal / Context</th>
                    <th className="py-2 px-3">Somatic Sensation</th>
                    <th className="py-2 px-3">Insulin Given</th>
                    <th className="py-2 px-3 rounded-r">Physician Flag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-on-surface">
                  <tr className="hover:bg-surface-container/40 transition-colors">
                    <td className="py-2.5 px-3 font-label-md text-outline">Oct 28 · 08:15 AM</td>
                    <td className="py-2.5 px-3 font-semibold">Idli + Sambhar (PG Mess)</td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center gap-1 text-primary text-[0.7rem] font-bold bg-primary-container/20 px-2.5 py-0.5 rounded-full border border-primary/20">
                        Energized · Post 6k Run
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-on-surface">Regular · 20 U</td>
                    <td className="py-2.5 px-3 text-outline">Normal baseline</td>
                  </tr>
                  <tr className="hover:bg-surface-container/40 transition-colors">
                    <td className="py-2.5 px-3 font-label-md text-outline">Oct 28 · 04:45 PM</td>
                    <td className="py-2.5 px-3 font-semibold">Post-College Study · Tea</td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center gap-1 text-tertiary text-[0.7rem] font-bold bg-tertiary-container/20 px-2.5 py-0.5 rounded-full border border-tertiary/20">
                        Heavy Brain Fog + Thirst
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-outline-variant">— None</td>
                    <td className="py-2.5 px-3 text-tertiary font-bold">Likely Post-Prandial High</td>
                  </tr>
                  <tr className="hover:bg-surface-container/40 transition-colors">
                    <td className="py-2.5 px-3 font-label-md text-outline">Oct 27 · 09:10 PM</td>
                    <td className="py-2.5 px-3 font-semibold">Rice, Dal &amp; Curd</td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center gap-1 text-secondary text-[0.7rem] font-bold bg-secondary-container/20 px-2.5 py-0.5 rounded-full border border-secondary/20">
                        Calm &amp; Stable
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-on-surface">30/70 · 25 U</td>
                    <td className="py-2.5 px-3 text-outline">On-time adherence</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Clinical Attestation Footer */}
            <div className="mt-5 pt-4 border-t border-surface-container-high/40 flex flex-col sm:flex-row items-center justify-between gap-2 text-outline font-label-md text-[0.7rem]">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-[1.125rem]">verified</span>
                <span>Raw patient telemetry authenticated via Feelog Cryptographic Vault</span>
              </div>
              <span>Ref: {settings.doctor_name || 'Dr. S. Ramanathan, MD'} {settings.clinic_name ? `(${settings.clinic_name})` : ''}</span>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Regimen Settings & Profile Context */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Card 1: Prescribed Regimen Settings */}
          <div className="rounded-3xl bg-surface-container/70 border border-white/5 backdrop-blur-xl p-6 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-primary font-headline-sm text-sm font-bold">
                <span className="material-symbols-outlined">vaccines</span>
                <span className="text-on-surface">Prescribed Regimen</span>
              </div>
              <button
                onClick={() => setIsEditingUnits(!isEditingUnits)}
                className="px-3 py-1 rounded-full bg-surface-container-high text-on-surface-variant hover:text-on-surface font-label-md text-xs font-semibold transition-colors border border-white/5"
                type="button"
              >
                {isEditingUnits ? 'Cancel' : 'Edit Units'}
              </button>
            </div>
            <p className="font-body-md text-xs text-on-surface-variant mb-4">
              For daily checklist guidance and notification timing. Feelog never modifies or calculates dosages.
            </p>

            {isEditingUnits ? (
              <div className="space-y-3 p-3 rounded-2xl bg-surface-container-low border border-primary/20">
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1">Morning Regular (R) Units</label>
                  <input
                    type="number"
                    value={morningUnitsInput}
                    onChange={(e) => setMorningUnitsInput(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-xl bg-surface-container border border-white/10 text-on-surface text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1">Midday Regular (R) Units (3rd Dose)</label>
                  <input
                    type="number"
                    value={afternoonUnitsInput}
                    onChange={(e) => setAfternoonUnitsInput(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-xl bg-surface-container border border-white/10 text-on-surface text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1">Night 30/70 Biphasic Units</label>
                  <input
                    type="number"
                    value={nightUnitsInput}
                    onChange={(e) => setNightUnitsInput(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-xl bg-surface-container border border-white/10 text-on-surface text-sm font-bold"
                  />
                </div>
                <button
                  onClick={handleSaveUnits}
                  type="button"
                  className="w-full py-2 rounded-xl bg-primary text-on-primary font-bold text-xs"
                >
                  Save Prescribed Units
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Morning Dose Tile */}
                <div className="p-4 rounded-2xl bg-surface-container-low/80 border border-white/5 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 text-primary font-label-md text-xs uppercase font-bold">
                      <span className="material-symbols-outlined text-[1rem]">wb_sunny</span>
                      <span>Morning Basal / Bolus</span>
                    </div>
                    <div className="font-body-lg text-sm font-bold text-on-surface mt-0.5">Regular (R) Insulin</div>
                    <div className="font-label-md text-[0.68rem] text-outline">Target Schedule: 08:00 AM IST</div>
                  </div>
                  <div className="text-right">
                    <span className="font-headline-xl text-2xl font-bold text-primary">{settings.morning_regular_units}</span>
                    <span className="font-label-md text-[0.68rem] text-on-surface-variant block uppercase">Units</span>
                  </div>
                </div>

                {/* Midday Dose Tile */}
                <div className="p-4 rounded-2xl bg-surface-container-low/80 border border-white/5 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 text-tertiary font-label-md text-xs uppercase font-bold">
                      <span className="material-symbols-outlined text-[1rem]">restaurant</span>
                      <span>Midday 3rd Dose</span>
                    </div>
                    <div className="font-body-lg text-sm font-bold text-on-surface mt-0.5">Regular (R) Insulin</div>
                    <div className="font-label-md text-[0.68rem] text-outline">Flexible Schedule: ~01:30 PM IST</div>
                  </div>
                  <div className="text-right">
                    <span className="font-headline-xl text-2xl font-bold text-tertiary">{settings.afternoon_regular_units ?? 10}</span>
                    <span className="font-label-md text-[0.68rem] text-on-surface-variant block uppercase">Units</span>
                  </div>
                </div>

                {/* Night Dose Tile */}
                <div className="p-4 rounded-2xl bg-surface-container-low/80 border border-white/5 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 text-secondary font-label-md text-xs uppercase font-bold">
                      <span className="material-symbols-outlined text-[1rem]">bedtime</span>
                      <span>Night Biphasic Injection</span>
                    </div>
                    <div className="font-body-lg text-sm font-bold text-on-surface mt-0.5">30/70 Premixed Biphasic</div>
                    <div className="font-label-md text-[0.68rem] text-outline">Target Schedule: 08:30 PM IST</div>
                  </div>
                  <div className="text-right">
                    <span className="font-headline-xl text-2xl font-bold text-secondary">{settings.night_30_70_units}</span>
                    <span className="font-label-md text-[0.68rem] text-on-surface-variant block uppercase">Units</span>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 p-3 rounded-2xl bg-surface-container-lowest/50 border border-white/5 text-on-surface-variant font-label-md text-[0.7rem] flex items-start gap-2">
              <span className="material-symbols-outlined text-secondary text-[1rem] shrink-0 mt-0.5">info</span>
              <span>Never change insulin amounts without consulting Dr. Ramanathan or your local clinic physician.</span>
            </div>
          </div>

          {/* Card 2: Personal Profile & Student PG Context */}
          <div className="rounded-3xl bg-surface-container/70 border border-white/5 backdrop-blur-xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 font-headline-sm text-sm text-on-surface font-bold">
                <span className="material-symbols-outlined text-secondary">person_pin_circle</span>
                <span>PG &amp; Living Context</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-secondary-container/20 text-secondary font-label-md text-xs font-semibold border border-secondary/20">
                Student Profile
              </span>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-surface-container-low/70 border border-white/5 flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-surface-container-high border border-primary/30 flex items-center justify-center text-on-surface font-bold text-sm shrink-0">
                  VR
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-body-md text-sm font-bold text-on-surface">Vignesh R.</div>
                  <div className="font-label-md text-xs text-on-surface-variant">20 yrs · Engineering Student</div>
                  <div className="font-label-md text-[0.7rem] text-outline mt-0.5 truncate">Home: Coimbatore, TN · PG: Koramangala, BLR</div>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-surface-container-low/40 border border-white/5 flex items-center justify-between font-body-md text-xs">
                <span className="text-on-surface-variant flex items-center gap-2">
                  <span className="material-symbols-outlined text-[1.125rem] text-primary">directions_run</span>
                  <span>Daily Athletic Routine</span>
                </span>
                <span className="text-on-surface font-bold">5-10k Morning Runs</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-surface-container-high/40 border border-white/5">
                <div className="flex items-center gap-1.5 text-tertiary font-label-md text-xs uppercase font-bold mb-1">
                  <span className="material-symbols-outlined text-[1rem]">sensors_off</span>
                  <span>Symptom-First Mode Active</span>
                </div>
                <p className="font-label-md text-xs text-on-surface-variant">
                  Currently no glucometer/CGM kept in PG room. Feelog prioritizes thirst cues, fatigue alerts, and carb estimates until home check-up in Coimbatore.
                </p>
              </div>
            </div>
          </div>

          {/* Card 3: App & Safety Preferences */}
          <div className="rounded-3xl bg-surface-container/70 border border-white/5 backdrop-blur-xl p-6 shadow-xl">
            <div className="flex items-center gap-2 font-headline-sm text-sm text-on-surface font-bold mb-4">
              <span className="material-symbols-outlined text-outline">tune</span>
              <span>Preferences &amp; Safety</span>
            </div>

            <div className="space-y-4">
              {/* Toggle 1: 5-Second Rapid Haptics */}
              <div className="flex items-center justify-between">
                <div className="pr-2">
                  <div className="font-body-md text-xs font-bold text-on-surface">5-Second Fast Haptics</div>
                  <div className="font-label-md text-[0.7rem] text-on-surface-variant">Vibrate softly during 1-tap dial logs</div>
                </div>
                <button
                  onClick={() => setHapticsEnabled(!hapticsEnabled)}
                  type="button"
                  className={`w-12 h-6 rounded-full p-0.5 transition-colors duration-200 ease-in-out relative shrink-0 ${
                    hapticsEnabled ? 'bg-primary-container' : 'bg-surface-container-high'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full bg-on-primary block transform transition duration-200 ${
                    hapticsEnabled ? 'translate-x-6' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* Toggle 2: Offline-First Supabase Sync */}
              <div className="flex items-center justify-between">
                <div className="pr-2">
                  <div className="font-body-md text-xs font-bold text-on-surface">Supabase Cloud Vault</div>
                  <div className="font-label-md text-[0.7rem] text-on-surface-variant">Offline caching with instant sync on PG Wi-Fi</div>
                </div>
                <button
                  onClick={() => setCloudSyncEnabled(!cloudSyncEnabled)}
                  type="button"
                  className={`w-12 h-6 rounded-full p-0.5 transition-colors duration-200 ease-in-out relative shrink-0 ${
                    cloudSyncEnabled ? 'bg-primary-container' : 'bg-surface-container-high'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full bg-on-primary block transform transition duration-200 ${
                    cloudSyncEnabled ? 'translate-x-6' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* Emergency Contacts */}
              <div className="pt-2">
                <div className="font-label-md text-xs text-outline uppercase font-bold mb-2">Emergency Hypo Contacts</div>
                <div className="flex flex-col gap-2">
                  <div className="p-2.5 rounded-xl bg-surface-container-low border border-white/5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-secondary text-[1rem]">call</span>
                      <span className="text-on-surface font-semibold">Parents (Tirupattur)</span>
                    </div>
                    <span className="text-on-surface-variant font-mono text-xs">+91 93603 •••••</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-surface-container-low border border-white/5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-secondary text-[1rem]">call</span>
                      <span className="text-on-surface font-semibold">Roommate (Sri Sathya Sai PG)</span>
                    </div>
                    <span className="text-on-surface-variant font-mono text-xs">+91 97870 •••••</span>
                  </div>
                </div>
              </div>

              {/* Seed Demo Data Button */}
              <button
                onClick={() => {
                  seedRealisticPGData();
                  flushOfflineQueue();
                  setExportSuccess('Loaded 14 days of realistic Bangalore PG student logs!');
                  setTimeout(() => setExportSuccess(null), 3000);
                }}
                className="w-full py-2 px-3 rounded-full bg-surface-container-high hover:bg-surface-container-highest text-primary font-bold text-xs transition-colors border border-primary/20"
                type="button"
              >
                Reload Realistic PG Dataset
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
