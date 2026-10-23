'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  User,
  Syringe,
  Globe,
  Database,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  Server,
  Cloud,
  RefreshCw,
} from 'lucide-react';
import {
  getSettings,
  saveSettings,
  DEFAULT_SETTINGS,
  seedRealisticPGData,
  clearAllLocalData,
  flushOfflineQueue,
} from '@/lib/sync-storage';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { UserSettings, MEDICAL_DISCLAIMER } from '@/types';

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [savedNotice, setSavedNotice] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [dataMessage, setDataMessage] = useState<string | null>(null);

  // Supabase connection form
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [savingSupabase, setSavingSupabase] = useState(false);
  const [isSyncingServer, setIsSyncingServer] = useState(false);

  useEffect(() => {
    setSettings(getSettings());
  }, []);

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
    const res = await flushOfflineQueue();
    setIsSyncingServer(false);
    setDataMessage(`Database updated: ${res.synced} items synchronized successfully.`);
    setTimeout(() => setDataMessage(null), 3500);
  };

  const handleSeedDemoData = () => {
    seedRealisticPGData();
    flushOfflineQueue();
    setDataMessage('Successfully loaded 14 days of realistic Bangalore PG student logs and synced to database!');
    setTimeout(() => setDataMessage(null), 4000);
  };

  const handleResetData = () => {
    if (confirm('Are you sure you want to clear all logged data? This cannot be undone.')) {
      clearAllLocalData();
      setDataMessage('All local log data cleared.');
      setTimeout(() => setDataMessage(null), 3000);
    }
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
        setDataMessage('Supabase credentials configured! Restart dev server to activate.');
        setTimeout(() => window.location.reload(), 2000);
      } else {
        alert(data.error || 'Failed to save configuration.');
      }
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSavingSupabase(false);
    }
  };

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !isSupabaseConfigured || !supabase) return;

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: authEmail,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw error;
      setMagicLinkSent(true);
    } catch (err) {
      console.error(err);
      alert('Error sending magic link. Please check your Supabase credentials.');
    }
  };

  return (
    <div className="pb-28 max-w-lg mx-auto px-4 pt-4">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          <SettingsIcon className="w-4 h-4 text-teal-600" />
          <span>Configuration</span>
        </div>
        <h1 className="text-xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
          Settings & Database
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Regimen defaults, measurements, and database management
        </p>
      </div>

      {savedNotice && (
        <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-emerald-800 dark:text-emerald-300 text-xs font-bold rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          Settings saved successfully!
        </div>
      )}

      {dataMessage && (
        <div className="mb-4 p-3 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 text-teal-800 dark:text-teal-300 text-xs font-bold rounded-xl flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-teal-600" />
          {dataMessage}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5">
        {/* Profile Card */}
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <User className="w-4 h-4 text-teal-600" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Personal Profile
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={settings.display_name}
                onChange={(e) => handleChange('display_name', e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Height (cm)
                </label>
                <input
                  type="number"
                  value={settings.height_cm}
                  onChange={(e) => handleChange('height_cm', Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={settings.weight_kg}
                  onChange={(e) => handleChange('weight_kg', Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200"
                  required
                />
              </div>
            </div>
          </div>
        </div>

        {/* Insulin Regimen Defaults */}
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Syringe className="w-4 h-4 text-teal-600" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Fixed Insulin Doses (Pre-fill defaults)
            </span>
          </div>

          <p className="text-[11px] text-slate-500 mb-3">
            These values pre-fill your daily morning and night confirmation buttons.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Morning Regular (R) Units
              </label>
              <input
                type="number"
                step="0.5"
                value={settings.morning_regular_units}
                onChange={(e) => handleChange('morning_regular_units', Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-black text-teal-600 dark:text-teal-400"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Night 30/70 Units
              </label>
              <input
                type="number"
                step="0.5"
                value={settings.night_30_70_units}
                onChange={(e) => handleChange('night_30_70_units', Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-black text-indigo-600 dark:text-indigo-400"
                required
              />
            </div>
          </div>
        </div>

        {/* Timezone (Fixed) */}
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-4 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Globe className="w-4 h-4 text-slate-400" />
            <div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Application Timezone
              </div>
              <div className="text-[11px] text-slate-500">Fixed to India Standard Time</div>
            </div>
          </div>
          <span className="text-xs font-bold text-teal-600 bg-teal-50 dark:bg-teal-950/40 px-2.5 py-1 rounded-lg border border-teal-200/50">
            Asia/Kolkata (IST)
          </span>
        </div>

        {/* Save Settings Button */}
        <button
          type="submit"
          className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-[0.99] min-h-[48px]"
        >
          Save Configuration
        </button>
      </form>

      {/* Database Management Card */}
      <div className="mt-6 bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-4 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-teal-600" />
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            Database Status & Sync
          </span>
        </div>

        {/* Active Database Status */}
        <div className="p-3 bg-slate-50 dark:bg-slate-750 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
              <Server className="w-3.5 h-3.5 text-teal-600" />
              <span>Server Database</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              Active (`data/db.json`)
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            All your daily logs are automatically saved to your local backend database.
          </p>

          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncingServer}
            className="w-full mt-2 py-2 px-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingServer ? 'animate-spin' : ''}`} />
            {isSyncingServer ? 'Syncing...' : 'Sync All Logs to Database Now'}
          </button>
        </div>

        {/* Optional Supabase Cloud Connection */}
        <div className="p-3 bg-slate-50 dark:bg-slate-750 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
              <Cloud className="w-3.5 h-3.5 text-indigo-600" />
              <span>Supabase Cloud Database (Optional)</span>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              isSupabaseConfigured
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
            }`}>
              {isSupabaseConfigured ? 'Connected' : 'Not Linked'}
            </span>
          </div>

          <p className="text-[11px] text-slate-500">
            Want to sync with Supabase Cloud Postgres? Enter your Supabase project credentials:
          </p>

          <form onSubmit={handleSaveSupabase} className="space-y-2">
            <div>
              <label className="block text-[10px] font-semibold text-slate-500">
                Supabase URL
              </label>
              <input
                type="url"
                placeholder="https://xyz.supabase.co"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-500">
                Supabase Anon Key
              </label>
              <input
                type="password"
                placeholder="eyJhbGciOi..."
                value={supabaseKey}
                onChange={(e) => setSupabaseKey(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={savingSupabase || !supabaseUrl || !supabaseKey}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-bold rounded-lg transition-colors"
            >
              {savingSupabase ? 'Saving...' : 'Connect Supabase Cloud'}
            </button>
          </form>

          {isSupabaseConfigured && (
            <form onSubmit={handleSendMagicLink} className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <label className="block text-[11px] font-semibold text-slate-500">
                Sign In via Supabase Email Magic Link
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="your.email@example.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
                <button
                  type="submit"
                  className="px-3 py-2 bg-slate-800 text-white font-bold rounded-xl text-xs"
                >
                  Send Link
                </button>
              </div>
              {magicLinkSent && (
                <p className="text-[11px] text-emerald-600 font-semibold mt-1">
                  Magic link sent to your inbox!
                </p>
              )}
            </form>
          )}
        </div>
      </div>

      {/* Demo Data & Reset Actions */}
      <div className="mt-6 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/50 space-y-3">
        <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
          Demo Testing & Reset
        </div>

        <button
          type="button"
          onClick={handleSeedDemoData}
          className="w-full py-2.5 px-3 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-teal-100 transition-colors"
        >
          <Sparkles className="w-4 h-4 text-teal-600" />
          Load 14-Day South Indian PG Demo Data
        </button>

        <button
          type="button"
          onClick={handleResetData}
          className="w-full py-2.5 px-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"
        >
          <RotateCcw className="w-4 h-4 text-red-600" />
          Clear All Logged Data
        </button>
      </div>

      <p className="text-[10px] text-slate-400 text-center mt-6">
        {MEDICAL_DISCLAIMER}
      </p>
    </div>
  );
}
