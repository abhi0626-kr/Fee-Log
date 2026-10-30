'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  getSettings,
  saveSettings,
  DEFAULT_SETTINGS,
  seedRealisticPGData,
  clearAllLocalData,
  clearOfflineQueue,
  flushOfflineQueue,
  getOfflineQueue,
  setUserLoggedIn,
  isUserLoggedIn,
  deduplicateLogs,
} from '@/lib/sync-storage';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { UserSettings, COMMON_FOOD_CHIPS } from '@/types';

const COMMON_TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST · UTC+05:30)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST · UTC+04:00)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT · UTC+08:00)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'America/New_York', label: 'America/New_York (EST/EDT)' },
  { value: 'America/Chicago', label: 'America/Chicago (CST/CDT)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST/PDT)' },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
];

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasCloudSession, setHasCloudSession] = useState(false);
  const [cloudEmail, setCloudEmail] = useState<string | null>(null);
  const [pendingQueueCount, setPendingQueueCount] = useState(0);
  const [savedNotice, setSavedNotice] = useState(false);
  const [dataMessage, setDataMessage] = useState<string | null>(null);
  const [showDevVault, setShowDevVault] = useState(false);

  // Developer connection form
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [savingSupabase, setSavingSupabase] = useState(false);
  const [isSyncingServer, setIsSyncingServer] = useState(false);

  // Quick Food Chips customizer
  const [newFoodChipText, setNewFoodChipText] = useState('');

  const handleAddFoodChip = () => {
    const trimmed = newFoodChipText.trim().toLowerCase();
    if (!trimmed) return;
    const currentChips = Array.isArray(settings.food_chips) && settings.food_chips.length > 0
      ? settings.food_chips
      : COMMON_FOOD_CHIPS;
    if (currentChips.some((c) => c.toLowerCase() === trimmed)) {
      setNewFoodChipText('');
      return;
    }
    const updated = [...currentChips, trimmed];
    handleChange('food_chips', updated);
    setNewFoodChipText('');
  };

  const handleRemoveFoodChip = (chipToRemove: string) => {
    const currentChips = Array.isArray(settings.food_chips) && settings.food_chips.length > 0
      ? settings.food_chips
      : COMMON_FOOD_CHIPS;
    const updated = currentChips.filter((c) => c !== chipToRemove);
    handleChange('food_chips', updated);
  };

  const handleResetFoodChips = () => {
    handleChange('food_chips', COMMON_FOOD_CHIPS);
  };

  useEffect(() => {
    setSettings(getSettings());
    setIsLoggedIn(isUserLoggedIn());
    setPendingQueueCount(getOfflineQueue().length);

    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session?.user) {
          setHasCloudSession(true);
          setCloudEmail(data.session.user.email || null);
        } else {
          setHasCloudSession(false);
          setCloudEmail(null);
        }
      });

      const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          setHasCloudSession(true);
          setCloudEmail(session.user.email || null);
        } else {
          setHasCloudSession(false);
          setCloudEmail(null);
        }
      });

      return () => {
        authListener.subscription.unsubscribe();
      };
    }
  }, []);

  const handleSignOut = async () => {
    if (confirm('Are you sure you want to sign out of Feelog?')) {
      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.auth.signOut();
        } catch {
          // ignore
        }
      }
      setUserLoggedIn(false, {
        auth_provider: 'guest',
        email: '',
        is_logged_in: false,
      });
      setIsLoggedIn(false);
      setDataMessage('Signed out successfully.');
      setTimeout(() => {
        router.push('/login');
      }, 500);
    }
  };

  const handleChange = (field: keyof UserSettings, value: unknown) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettings(settings);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const handleManualSync = async () => {
    setIsSyncingServer(true);
    setDataMessage(null);
    try {
      let hasSession = false;
      if (isSupabaseConfigured && supabase) {
        let { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          const { data: refreshed } = await supabase.auth.refreshSession();
          sessionData = refreshed;
        }
        hasSession = Boolean(sessionData.session?.user);
      }

      if (!hasSession && isSupabaseConfigured) {
        const qCount = getOfflineQueue().length;
        setDataMessage(
          qCount > 0
            ? `Cloud session not active (${qCount} pending log${qCount > 1 ? 's' : ''}). Sign in with Google to sync.`
            : 'Cloud session not active. Sign in with Google to enable automatic cloud sync.'
        );
        setIsSyncingServer(false);
        return;
      }

      const res = await flushOfflineQueue();
      const remaining = getOfflineQueue().length;
      setPendingQueueCount(remaining);

      if (res.failed > 0 || remaining > 0) {
        setDataMessage(
          res.errorMessage ||
          `Sync incomplete: ${res.synced} processed, ${remaining} still pending. Check connection or sign in again.`
        );
      } else {
        setDataMessage(`Sync complete: ${res.synced} pending items processed.`);
      }
    } catch (error) {
      setDataMessage(`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}.`);
    } finally {
      setIsSyncingServer(false);
    }
    setTimeout(() => setDataMessage(null), 4500);
  };

  const handleClearPendingQueue = () => {
    clearOfflineQueue();
    setPendingQueueCount(0);
    setDataMessage('Pending sync queue cleared. Local logs remain safe in browser storage.');
    setTimeout(() => setDataMessage(null), 3500);
  };

  const handleSeedDemoData = () => {
    seedRealisticPGData();
    flushOfflineQueue();
    setDataMessage('Loaded 14 days of realistic PG student rhythm logs.');
    setTimeout(() => setDataMessage(null), 4000);
  };

  const handleResetData = () => {
    if (confirm('Are you sure you want to clear all logged diary data? This cannot be undone.')) {
      clearAllLocalData();
      setDataMessage('All local log data cleared.');
      setTimeout(() => setDataMessage(null), 3000);
    }
  };

  const handleDeduplicate = () => {
    const res = deduplicateLogs();
    if (res.total > 0) {
      setDataMessage(
        `Cleaned up ${res.total} duplicate log${res.total > 1 ? 's' : ''} across your food, insulin, and telemetry records.`
      );
    } else {
      setDataMessage('No duplicate entries found. Your logs are completely clean!');
    }
    setTimeout(() => setDataMessage(null), 4000);
  };

  const handleSaveSupabase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseUrl || !supabaseKey) return;
    setSavingSupabase(true);
    try {
      const res = await fetch('/api/supabase-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: supabaseUrl, anonKey: supabaseKey }),
      });
      const data = await res.json();
      if (data.success) {
        setDataMessage('Custom cloud credentials saved! Restarting...');
        setTimeout(() => window.location.reload(), 1500);
      } else {
        alert(data.error || 'Failed to save configuration.');
      }
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSavingSupabase(false);
    }
  };

  const isSignedInGoogle = Boolean(hasCloudSession);
  const displayEmail = cloudEmail || settings.email;

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-2">
        <div>
          <div className="flex items-center gap-2 text-primary font-label-md text-xs uppercase tracking-wider mb-1 font-bold">
            <span className="material-symbols-outlined text-[1rem]">tune</span>
            <span>Profile, Regimen &amp; Privacy</span>
          </div>
          <h1 className="font-headline-xl text-2xl md:text-3xl text-on-surface font-extrabold tracking-tight">
            Settings &amp; Regimen
          </h1>
          <p className="font-body-md text-sm text-on-surface-variant mt-1 max-w-2xl">
            Customize your insulin brands, default doses, injection timings, city, and clinical contacts.
          </p>
        </div>

        {savedNotice && (
          <div className="px-4 py-1.5 rounded-full bg-primary/20 border border-primary/30 text-primary text-xs font-bold animate-in fade-in flex items-center gap-1.5 self-start md:self-auto">
            <span className="material-symbols-outlined text-sm">check_circle</span>
            <span>Settings saved successfully</span>
          </div>
        )}
      </div>

      {dataMessage && (
        <div className="p-3 rounded-2xl bg-primary/10 border border-primary/30 text-primary text-xs font-semibold text-center animate-in fade-in">
          {dataMessage}
        </div>
      )}

      {/* Account & Sync Bar */}
      <div className="rounded-2xl sm:rounded-3xl bg-surface-container/70 border border-white/5 backdrop-blur-xl p-3.5 sm:p-5 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary font-extrabold text-sm sm:text-base shrink-0">
            {settings.display_name?.slice(0, 2).toUpperCase() || 'AB'}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span className="font-headline-sm text-sm sm:text-base text-on-surface font-bold truncate">
                {settings.display_name || 'Abhishek'}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[0.65rem] font-bold border ${
                isSignedInGoogle
                  ? 'bg-primary-container/20 text-primary border-primary/20'
                  : settings.email
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : 'bg-surface-container-high text-on-surface-variant border-white/5'
              }`}>
                {isSignedInGoogle
                  ? 'Google Account (Cloud Synced)'
                  : settings.email
                  ? 'Cloud Session Inactive'
                  : 'Guest / Local Mode'}
              </span>
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5 truncate">
              {isSignedInGoogle ? (
                displayEmail
              ) : settings.email ? (
                <span>{settings.email} · Sign in with Google to sync logs to cloud</span>
              ) : (
                <>
                  <span className="hidden sm:inline">Your logs are stored securely in local browser storage.</span>
                  <span className="sm:hidden">Private local storage</span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncingServer}
            className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-surface-container-high hover:bg-surface-bright text-secondary text-xs font-semibold transition-all border border-secondary/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-sm ${isSyncingServer ? 'animate-spin' : ''}`}>sync</span>
            <span className="hidden sm:inline">{isSyncingServer ? 'Syncing...' : 'Sync Now'}</span>
            <span className="sm:hidden">{isSyncingServer ? 'Syncing...' : 'Sync'}</span>
          </button>

          <Link
            href="/login"
            className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-primary text-on-primary font-bold text-xs transition-all shadow-md active:scale-95 flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">account_circle</span>
            <span className="hidden sm:inline">{isSignedInGoogle ? 'Account Details' : 'Sign in with Google'}</span>
            <span className="sm:hidden">{isSignedInGoogle ? 'Account' : 'Sign In'}</span>
          </Link>

          {isLoggedIn && (
            <button
              type="button"
              onClick={handleSignOut}
              className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-error/15 hover:bg-error/25 text-error font-bold text-xs transition-all border border-error/30 flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="Sign out of Feelog"
            >
              <span className="material-symbols-outlined text-sm">logout</span>
              <span className="hidden sm:inline">Sign Out</span>
              <span className="sm:hidden">Logout</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* SECTION 1: INSULIN BRANDS, UNITS & TIMINGS */}
        <div className="rounded-3xl bg-surface-container/70 border border-white/5 backdrop-blur-xl p-6 shadow-xl">
          <div className="flex items-center gap-2 font-headline-sm text-sm text-on-surface font-bold pb-4 border-b border-surface-container-high/40 mb-5">
            <span className="material-symbols-outlined text-primary">vaccines</span>
            <span>Insulin Regimen, Brands &amp; Dose Timings</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Morning Dose Box */}
            <div className="p-4 rounded-2xl bg-surface-container-low border border-primary/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">wb_sunny</span>
                  Morning Dose
                </span>
                <span className="text-[0.65rem] text-on-surface-variant font-medium">Basal / Bolus</span>
              </div>

              <div>
                <label className="text-[11px] text-on-surface-variant font-semibold block mb-1">Insulin Brand / Type</label>
                <input
                  type="text"
                  value={settings.morning_insulin_brand || 'Regular (R)'}
                  onChange={(e) => handleChange('morning_insulin_brand', e.target.value)}
                  placeholder="e.g. Regular (R), Humalog, Actrapid"
                  className="w-full px-3 py-2 rounded-xl bg-surface-container border border-white/10 text-on-surface text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-on-surface-variant font-semibold block mb-1">Target Time</label>
                  <input
                    type="time"
                    value={settings.morning_target_time || '08:00'}
                    onChange={(e) => handleChange('morning_target_time', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-surface-container border border-white/10 text-primary font-bold text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-on-surface-variant font-semibold block mb-1">Default Units (U)</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={settings.morning_regular_units}
                    onChange={(e) => handleChange('morning_regular_units', Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-surface-container border border-white/10 text-primary font-bold text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-on-surface-variant font-semibold block mb-1">Meal / Context Note</label>
                <input
                  type="text"
                  value={settings.morning_meal_note || 'Before PG breakfast (Idly / Dosa)'}
                  onChange={(e) => handleChange('morning_meal_note', e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-surface-container border border-white/10 text-on-surface-variant text-[11px]"
                />
              </div>
            </div>

            {/* Midday Dose Box (3rd Dose) */}
            <div className="p-4 rounded-2xl bg-surface-container-low border border-tertiary/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-tertiary uppercase tracking-wider flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">restaurant</span>
                  Midday Dose (3rd Dose)
                </span>
                <span className="text-[0.65rem] text-on-surface-variant font-medium">As Needed / Lunch</span>
              </div>

              <div>
                <label className="text-[11px] text-on-surface-variant font-semibold block mb-1">Insulin Brand / Type</label>
                <input
                  type="text"
                  value={settings.midday_insulin_brand || 'Regular (R)'}
                  onChange={(e) => handleChange('midday_insulin_brand', e.target.value)}
                  placeholder="e.g. Regular (R), Novorapid, Apidra"
                  className="w-full px-3 py-2 rounded-xl bg-surface-container border border-white/10 text-on-surface text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-tertiary"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-on-surface-variant font-semibold block mb-1">Target Time</label>
                  <input
                    type="time"
                    value={settings.midday_target_time || '13:30'}
                    onChange={(e) => handleChange('midday_target_time', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-surface-container border border-white/10 text-tertiary font-bold text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-on-surface-variant font-semibold block mb-1">Default Units (U)</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={settings.afternoon_regular_units ?? 10}
                    onChange={(e) => handleChange('afternoon_regular_units', Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-surface-container border border-white/10 text-tertiary font-bold text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-on-surface-variant font-semibold block mb-1">Meal / Context Note</label>
                <input
                  type="text"
                  value={settings.midday_meal_note || 'Before lunch / based on body condition'}
                  onChange={(e) => handleChange('midday_meal_note', e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-surface-container border border-white/10 text-on-surface-variant text-[11px]"
                />
              </div>
            </div>

            {/* Night Regimen Box */}
            <div className="p-4 rounded-2xl bg-surface-container-low border border-secondary/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-secondary uppercase tracking-wider flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">bedtime</span>
                  Night Regimen
                </span>
                <span className="text-[0.65rem] text-on-surface-variant font-medium">Biphasic / Basal</span>
              </div>

              <div>
                <label className="text-[11px] text-on-surface-variant font-semibold block mb-1">Insulin Brand / Type</label>
                <input
                  type="text"
                  value={settings.night_insulin_brand || '30/70 Biphasic Mix'}
                  onChange={(e) => handleChange('night_insulin_brand', e.target.value)}
                  placeholder="e.g. 30/70 Biphasic, Lantus, Tresiba, Mixtard"
                  className="w-full px-3 py-2 rounded-xl bg-surface-container border border-white/10 text-on-surface text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-secondary"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-on-surface-variant font-semibold block mb-1">Target Time</label>
                  <input
                    type="time"
                    value={settings.night_target_time || '20:30'}
                    onChange={(e) => handleChange('night_target_time', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-surface-container border border-white/10 text-secondary font-bold text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-on-surface-variant font-semibold block mb-1">Default Units (U)</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={settings.night_30_70_units}
                    onChange={(e) => handleChange('night_30_70_units', Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-surface-container border border-white/10 text-secondary font-bold text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-on-surface-variant font-semibold block mb-1">Meal / Context Note</label>
                <input
                  type="text"
                  value={settings.night_meal_note || 'Before PG dinner (Chapati / Rice)'}
                  onChange={(e) => handleChange('night_meal_note', e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-surface-container border border-white/10 text-on-surface-variant text-[11px]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: PERSONAL IDENTITY & PHYSICAL METRICS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-3xl bg-surface-container/70 border border-white/5 backdrop-blur-xl p-6 shadow-xl">
            <div className="flex items-center gap-2 font-headline-sm text-sm text-on-surface font-bold pb-4 border-b border-surface-container-high/40 mb-4">
              <span className="material-symbols-outlined text-secondary">person</span>
              <span>Personal Profile</span>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="text-on-surface-variant block mb-1 font-semibold">Display Name</label>
                <input
                  type="text"
                  value={settings.display_name}
                  onChange={(e) => handleChange('display_name', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-white/10 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-on-surface-variant block mb-1 font-semibold">Email Address (Profile / Reports)</label>
                <input
                  type="email"
                  value={settings.email || ''}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="e.g. yourname@gmail.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-white/10 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-on-surface-variant/40"
                />
                <p className="text-[10px] text-on-surface-variant mt-1">
                  Used on doctor export reports and profile identification. Sign in with Google on the Account page to link cloud sync.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-on-surface-variant block mb-1 font-semibold">Age</label>
                  <input
                    type="number"
                    value={settings.age ?? 20}
                    onChange={(e) => handleChange('age', Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-white/10 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-on-surface-variant block mb-1 font-semibold">Gender</label>
                  <input
                    type="text"
                    value={settings.gender || 'Male'}
                    onChange={(e) => handleChange('gender', e.target.value)}
                    placeholder="Male / Female / Other"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-white/10 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-on-surface-variant block mb-1 font-semibold">Height (cm)</label>
                  <input
                    type="number"
                    value={settings.height_cm}
                    onChange={(e) => handleChange('height_cm', Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-white/10 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-on-surface-variant block mb-1 font-semibold">Weight (kg)</label>
                  <input
                    type="number"
                    value={settings.weight_kg}
                    onChange={(e) => handleChange('weight_kg', Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-white/10 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Location & Lifestyle Context */}
          <div className="rounded-3xl bg-surface-container/70 border border-white/5 backdrop-blur-xl p-6 shadow-xl">
            <div className="flex items-center gap-2 font-headline-sm text-sm text-on-surface font-bold pb-4 border-b border-surface-container-high/40 mb-4">
              <span className="material-symbols-outlined text-tertiary">location_on</span>
              <span>Location &amp; Lifestyle Context</span>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-on-surface-variant block mb-1 font-semibold">Current City</label>
                  <input
                    type="text"
                    value={settings.city || 'Bangalore'}
                    onChange={(e) => handleChange('city', e.target.value)}
                    placeholder="e.g. Bangalore, Mumbai"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-white/10 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-on-surface-variant block mb-1 font-semibold">Living Area / PG</label>
                  <input
                    type="text"
                    value={settings.residence_area || 'Koramangala PG'}
                    onChange={(e) => handleChange('residence_area', e.target.value)}
                    placeholder="e.g. Koramangala PG"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-white/10 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-on-surface-variant block mb-1 font-semibold">Native Place / State</label>
                <input
                  type="text"
                  value={settings.native_location || 'Coimbatore, Tamil Nadu'}
                  onChange={(e) => handleChange('native_location', e.target.value)}
                  placeholder="e.g. Coimbatore, Tamil Nadu"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-white/10 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-on-surface-variant block mb-1 font-semibold">Lifestyle / Routine Summary</label>
                <input
                  type="text"
                  value={settings.lifestyle_note || 'Studying & Running away from native Tamil Nadu'}
                  onChange={(e) => handleChange('lifestyle_note', e.target.value)}
                  placeholder="e.g. Studying at university, morning runs"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-white/10 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-on-surface-variant block mb-1 font-semibold">Timezone</label>
                <select
                  value={settings.timezone || 'Asia/Kolkata'}
                  onChange={(e) => handleChange('timezone', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-white/10 text-on-surface text-xs focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  {COMMON_TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value} className="bg-surface-container text-on-surface">
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: CLINICAL & EMERGENCY CONTACTS */}
        <div className="rounded-3xl bg-surface-container/70 border border-white/5 backdrop-blur-xl p-6 shadow-xl">
          <div className="flex items-center gap-2 font-headline-sm text-sm text-on-surface font-bold pb-4 border-b border-surface-container-high/40 mb-4">
            <span className="material-symbols-outlined text-primary">medical_services</span>
            <span>Physician &amp; Emergency Contacts (For Doctor Consultation Reports)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="text-on-surface-variant block mb-1 font-semibold">Doctor / Endocrinologist</label>
              <input
                type="text"
                value={settings.doctor_name || ''}
                onChange={(e) => handleChange('doctor_name', e.target.value)}
                placeholder="e.g. Dr. S. Ramanathan, MD"
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-white/10 text-on-surface text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-on-surface-variant block mb-1 font-semibold">Clinic / Hospital</label>
              <input
                type="text"
                value={settings.clinic_name || ''}
                onChange={(e) => handleChange('clinic_name', e.target.value)}
                placeholder="e.g. Manipal BLR / Clinic"
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-white/10 text-on-surface text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-on-surface-variant block mb-1 font-semibold">Doctor Phone</label>
              <input
                type="tel"
                value={settings.doctor_phone || ''}
                onChange={(e) => handleChange('doctor_phone', e.target.value)}
                placeholder="+91 98420 12345"
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-white/10 text-on-surface text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-on-surface-variant block mb-1 font-semibold">Emergency Contact Phone</label>
              <input
                type="tel"
                value={settings.emergency_contact_phone || ''}
                onChange={(e) => handleChange('emergency_contact_phone', e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-white/10 text-on-surface text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* SECTION: DAILY NUTRITION & MACRO TARGETS */}
        <div className="rounded-3xl bg-surface-container/70 border border-white/5 backdrop-blur-xl p-6 shadow-xl">
          <div className="flex items-center gap-2 font-headline-sm text-sm text-on-surface font-bold pb-4 border-b border-surface-container-high/40 mb-4">
            <span className="material-symbols-outlined text-tertiary">monitor_weight</span>
            <span>Daily Nutrition &amp; Fitness Targets</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="text-on-surface-variant block mb-1 font-semibold">Daily Carbs Target (g)</label>
              <input
                type="number"
                min="0"
                value={settings.daily_target_carbs_g ?? 180}
                onChange={(e) => handleChange('daily_target_carbs_g', Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-white/10 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="text-[10px] text-outline mt-1 block">For insulin bolus matching</span>
            </div>

            <div>
              <label className="text-on-surface-variant block mb-1 font-semibold">Daily Protein Target (g)</label>
              <input
                type="number"
                min="0"
                value={settings.daily_target_protein_g ?? 75}
                onChange={(e) => handleChange('daily_target_protein_g', Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-white/10 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
              />
              <span className="text-[10px] text-outline mt-1 block">Muscle recovery &amp; workout</span>
            </div>

            <div>
              <label className="text-on-surface-variant block mb-1 font-semibold">Daily Fiber Target (g)</label>
              <input
                type="number"
                min="0"
                value={settings.daily_target_fiber_g ?? 30}
                onChange={(e) => handleChange('daily_target_fiber_g', Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-white/10 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-tertiary"
              />
              <span className="text-[10px] text-outline mt-1 block">Slows carb digestion</span>
            </div>

            <div>
              <label className="text-on-surface-variant block mb-1 font-semibold">Daily Max Sugar (g)</label>
              <input
                type="number"
                min="0"
                step="1"
                value={settings.daily_max_sugar_g ?? 25}
                onChange={(e) => handleChange('daily_max_sugar_g', Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-white/10 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-pink-400"
              />
              <span className="text-[10px] text-outline mt-1 block">WHO / ADA guideline for spike control</span>
            </div>
          </div>

          {/* AI Vision Plate Scanner Config */}
          <div className="mt-5 pt-4 border-t border-surface-container-high/40">
            <div className="flex items-center justify-between mb-2">
              <label className="text-on-surface-variant font-semibold flex items-center gap-1.5 text-xs">
                <span className="material-symbols-outlined text-tertiary text-sm">auto_awesome</span>
                <span>AI Photo Plate Scanner Key (OpenAI, Groq, or Gemini)</span>
              </label>
              <div className="flex items-center gap-2">
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-tertiary hover:underline font-semibold flex items-center gap-0.5"
                >
                  <span>Groq</span>
                  <span className="material-symbols-outlined text-xs">open_in_new</span>
                </a>
                <span className="text-outline text-xs">|</span>
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-tertiary hover:underline font-semibold flex items-center gap-0.5"
                >
                  <span>OpenAI</span>
                  <span className="material-symbols-outlined text-xs">open_in_new</span>
                </a>
                <span className="text-outline text-xs">|</span>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-tertiary hover:underline font-semibold flex items-center gap-0.5"
                >
                  <span>Gemini</span>
                  <span className="material-symbols-outlined text-xs">open_in_new</span>
                </a>
              </div>
            </div>
            <input
              type="password"
              value={settings.groq_api_key || settings.openai_api_key || settings.gemini_api_key || ''}
              onChange={(e) => {
                const val = e.target.value.trim();
                if (val.startsWith('gsk_')) {
                  handleChange('groq_api_key', val);
                  handleChange('openai_api_key', '');
                  handleChange('gemini_api_key', '');
                } else if (val.startsWith('sk-')) {
                  handleChange('openai_api_key', val);
                  handleChange('groq_api_key', '');
                  handleChange('gemini_api_key', '');
                } else {
                  handleChange('gemini_api_key', val);
                  handleChange('groq_api_key', '');
                  handleChange('openai_api_key', '');
                }
              }}
              placeholder="sk-... (OpenAI), gsk_... (Groq), or AIzaSy... (Gemini)"
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-white/10 text-on-surface text-xs font-mono focus:outline-none focus:ring-1 focus:ring-tertiary"
            />
            <p className="text-[10px] text-outline mt-1.5">
              Supports OpenAI (<code>sk-...</code>), Groq (<code>gsk_...</code>), and Google Gemini (<code>AIza...</code>) keys for meal photo scanning.
            </p>
          </div>
        </div>

        {/* SECTION: QUICK FOOD CHIPS */}
        <div className="rounded-3xl bg-surface-container/70 border border-white/5 backdrop-blur-xl p-6 shadow-xl">
          <div className="flex items-center justify-between pb-4 border-b border-surface-container-high/40 mb-4">
            <div className="flex items-center gap-2 font-headline-sm text-sm text-on-surface font-bold">
              <span className="material-symbols-outlined text-tertiary">restaurant</span>
              <span>Quick Food Chips &amp; Portions</span>
            </div>
            <button
              type="button"
              onClick={handleResetFoodChips}
              className="text-xs text-on-surface-variant hover:text-tertiary flex items-center gap-1 font-semibold transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-xs">restart_alt</span>
              <span>Reset to default</span>
            </button>
          </div>

          <p className="text-xs text-on-surface-variant mb-3">
            One-tap chips that appear in the Food Log sheet. Tap a chip while logging to choose exact weights (e.g. 100g Rice) or quantities (e.g. 3 Egg).
          </p>

          <div className="flex flex-wrap gap-2 mb-4">
            {(Array.isArray(settings.food_chips) && settings.food_chips.length > 0
              ? settings.food_chips
              : COMMON_FOOD_CHIPS
            ).map((chip) => (
              <span
                key={chip}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-tertiary-container/20 border border-tertiary/30 text-on-surface rounded-full shadow-sm"
              >
                + {chip}
                <button
                  type="button"
                  onClick={() => handleRemoveFoodChip(chip)}
                  className="hover:text-red-400 text-on-surface-variant p-0.5 rounded-full transition-colors cursor-pointer"
                  title={`Remove ${chip}`}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>

          <div className="flex gap-2 max-w-md">
            <input
              type="text"
              value={newFoodChipText}
              onChange={(e) => setNewFoodChipText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddFoodChip();
                }
              }}
              placeholder='Add item (e.g. "oats", "chicken", "paneer")...'
              className="flex-1 px-3.5 py-2 rounded-xl bg-surface-container-low border border-white/10 text-on-surface text-xs focus:outline-none focus:ring-1 focus:ring-tertiary"
            />
            <button
              type="button"
              onClick={handleAddFoodChip}
              className="px-4 py-2 rounded-xl bg-tertiary-container text-on-tertiary-container hover:bg-tertiary hover:text-on-tertiary font-bold text-xs transition-all active:scale-95 cursor-pointer"
            >
              Add Chip
            </button>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-between gap-4 p-4 rounded-3xl bg-surface-container-lowest/80 border border-white/5 backdrop-blur-md">
          <span className="text-xs text-on-surface-variant">
            Changes update your dashboard, timeline, and export reports in real-time.
          </span>
          <button
            type="submit"
            className="px-6 py-3 rounded-full bg-primary-container text-on-primary font-bold text-xs hover:bg-primary transition-all active:scale-95 shadow-lg shadow-primary/20 cursor-pointer"
          >
            Save All Preferences
          </button>
        </div>
      </form>

      {/* SECTION 4: DATA & PRIVACY MANAGEMENT */}
      <div className="rounded-3xl bg-surface-container/70 border border-white/5 backdrop-blur-xl p-6 shadow-xl">
        <div className="flex items-center gap-2 font-headline-sm text-sm text-on-surface font-bold pb-3 border-b border-surface-container-high/40 mb-4">
          <span className="material-symbols-outlined text-secondary">database</span>
          <span>Data Storage &amp; Demo Rhythms</span>
        </div>

        <div className="mb-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl bg-secondary-container/15 border border-secondary/20 p-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-headline-sm text-xs text-on-surface font-bold">Cloud Sync</span>
              {pendingQueueCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-secondary/20 text-secondary border border-secondary/30">
                  {pendingQueueCount} pending
                </span>
              )}
            </div>
            <p className="font-body-md text-[11px] text-on-surface-variant max-w-lg">
              {pendingQueueCount > 0
                ? `${pendingQueueCount} local update${pendingQueueCount > 1 ? 's' : ''} waiting to sync to the cloud database.`
                : 'All local changes are reconciled.'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {pendingQueueCount > 0 && (
              <button
                onClick={handleClearPendingQueue}
                type="button"
                className="px-3 py-2 rounded-full bg-surface-container-high hover:bg-surface-bright text-on-surface-variant hover:text-on-surface font-label-md text-xs font-semibold transition-all whitespace-nowrap border border-white/10"
                title="Keep logs stored locally on this device and clear the pending sync queue"
              >
                Clear Queue ({pendingQueueCount})
              </button>
            )}
            <button
              onClick={handleManualSync}
              type="button"
              disabled={isSyncingServer}
              className="px-4 py-2 rounded-full bg-secondary-container hover:bg-secondary text-on-secondary-container font-label-md text-xs font-bold transition-all whitespace-nowrap disabled:opacity-60"
            >
              {isSyncingServer ? 'Syncing...' : 'Sync Pending Logs Now'}
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="font-headline-sm text-xs text-on-surface font-bold">14-Day Realistic Bangalore PG Sample</div>
            <p className="font-body-md text-[11px] text-on-surface-variant max-w-lg">
              Seed realistic rice-spike patterns, morning runs, and meal telemetry to explore the charts and insights.
            </p>
          </div>
          <button
            onClick={handleSeedDemoData}
            type="button"
            className="px-4 py-2 rounded-full bg-surface-container-high hover:bg-surface-bright text-primary border border-primary/20 font-label-md text-xs font-bold transition-all whitespace-nowrap"
          >
            Load 14-Day Sample Data
          </button>
        </div>

        <div className="mt-4 pt-4 border-t border-surface-container-high/30 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="font-headline-sm text-xs text-on-surface font-bold">Deduplicate Log Entries</div>
            <p className="font-body-md text-[11px] text-on-surface-variant max-w-lg">
              Safely clean up duplicate dinner or meal entries across your local cache and Supabase cloud database.
            </p>
          </div>
          <button
            onClick={handleDeduplicate}
            type="button"
            className="px-4 py-2 rounded-full bg-surface-container-high hover:bg-surface-bright text-secondary border border-secondary/20 font-label-md text-xs font-bold transition-all whitespace-nowrap flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">auto_fix_high</span>
            <span>Clean Duplicates</span>
          </button>
        </div>

        <div className="mt-4 pt-4 border-t border-surface-container-high/30 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="font-headline-sm text-xs text-error font-bold">Reset Local Log Storage</div>
            <p className="font-body-md text-[11px] text-on-surface-variant">
              Permanently clear all logs, meals, and meter values from this device.
            </p>
          </div>
          <button
            onClick={handleResetData}
            type="button"
            className="px-4 py-2 rounded-full bg-error-container/20 hover:bg-error-container/30 text-error border border-error/20 font-label-md text-xs font-bold transition-all whitespace-nowrap"
          >
            Clear All Data
          </button>
        </div>
      </div>

      {/* SECTION 5: ADVANCED DEVELOPER SETTINGS (COLLAPSED) */}
      <div className="rounded-3xl bg-surface-container-lowest/50 border border-white/5 p-4 text-xs">
        <button
          type="button"
          onClick={() => setShowDevVault(!showDevVault)}
          className="w-full flex items-center justify-between text-on-surface-variant hover:text-on-surface font-semibold text-xs transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base">terminal</span>
            <span>Advanced Developer Cloud Credentials (Self-Hosted Supabase)</span>
          </div>
          <span className="material-symbols-outlined text-base">
            {showDevVault ? 'expand_less' : 'expand_more'}
          </span>
        </button>

        {showDevVault && (
          <form onSubmit={handleSaveSupabase} className="mt-4 pt-3 border-t border-white/5 space-y-3">
            <p className="text-[11px] text-on-surface-variant">
              Optional: For self-hosting engineers who want to point Feelog to their private Supabase Postgres cluster.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-on-surface-variant block mb-1">Supabase URL</label>
                <input
                  type="text"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  placeholder="https://xyzcompany.supabase.co"
                  className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-white/10 text-on-surface text-xs focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-on-surface-variant block mb-1">Anon Public Key</label>
                <input
                  type="password"
                  value={supabaseKey}
                  onChange={(e) => setSupabaseKey(e.target.value)}
                  placeholder="eyJhbGciOi..."
                  className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-white/10 text-on-surface text-xs focus:outline-none"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={savingSupabase}
              className="py-2 px-4 rounded-full bg-secondary-container text-on-secondary font-bold text-xs"
            >
              {savingSupabase ? 'Saving...' : 'Save Developer Keys'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
