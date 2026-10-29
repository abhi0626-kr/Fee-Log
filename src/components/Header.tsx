'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getAllLoggedDates, getSettings } from '@/lib/sync-storage';
import { calculateStreak } from '@/lib/date-utils';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { UserSettings } from '@/types';

interface HeaderProps {
  onNewEntry?: () => void;
}

export default function Header({ onNewEntry }: HeaderProps) {
  const pathname = usePathname();
  const [streak, setStreak] = useState<number>(0);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [hasCloudSession, setHasCloudSession] = useState(false);

  useEffect(() => {
    const updateHeader = () => {
      try {
        const dates = getAllLoggedDates();
        const st = calculateStreak(dates);
        setStreak(st);
        const s = getSettings();
        setSettings(s);
      } catch {
        setStreak(0);
      }
    };
    updateHeader();

    let authUnsub: (() => void) | undefined;
    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data }) => {
        setHasCloudSession(Boolean(data.session?.user));
      });
      const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
        setHasCloudSession(Boolean(session?.user));
      });
      authUnsub = () => listener.subscription.unsubscribe();
    }

    window.addEventListener('storage', updateHeader);
    window.addEventListener('t1d-data-updated', updateHeader);
    return () => {
      window.removeEventListener('storage', updateHeader);
      window.removeEventListener('t1d-data-updated', updateHeader);
      if (authUnsub) authUnsub();
    };
  }, [pathname]);

  const navLinks = [
    { href: '/', label: 'Quick', icon: 'edit_calendar' },
    { href: '/timeline', label: 'Timeline', icon: 'timeline' },
    { href: '/patterns', label: 'Insights', icon: 'insights' },
    { href: '/export', label: 'Export', icon: 'clinical_notes' },
    { href: '/settings', label: 'Settings', icon: 'tune' },
  ];

  return (
    <>
      <header className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-2xl border-b border-surface-container-high/40 shadow-[0_4px_30px_rgba(0,0,0,0.35)]">
        <div className="h-16 sm:h-20 max-w-[1240px] mx-auto px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-3 sm:gap-4">
          {/* Logo & Identity */}
          <div className="flex items-center gap-3 sm:gap-4">
            <Link href="/" className="flex items-center gap-1.5 sm:gap-2 group">
              <span className="font-headline-xl text-xl sm:text-headline-xl text-on-surface font-extrabold tracking-tight group-hover:text-primary transition-colors">
                Feelog
              </span>
              <span className="px-2 py-0.5 rounded-full bg-primary-container/20 text-primary font-label-md text-[10px] sm:text-xs uppercase tracking-wider font-bold border border-primary/20">
                <span className="hidden sm:inline">Type 1 Diary</span>
                <span className="sm:hidden">T1D</span>
              </span>
            </Link>
            <div className="hidden xl:flex items-center gap-2 text-on-surface-variant font-label-md text-xs pl-2 border-l border-surface-container-highest">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(78,222,163,0.8)]"></span>
              <span>{settings?.city || 'Bangalore'} · {settings?.timezone?.includes('Kolkata') ? 'IST' : settings?.timezone || 'IST'}</span>
            </div>
          </div>

          {/* Center Navigation Links (Desktop) */}
          {pathname !== '/login' && (
            <nav className="hidden lg:flex items-center p-1 bg-surface-container-lowest/80 rounded-full border border-surface-container-high/50 backdrop-blur-md">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-label={link.label}
                    title={link.label}
                    className={`flex items-center gap-1.5 px-3 h-10 rounded-full text-xs font-semibold transition-all duration-200 ${
                      isActive
                        ? 'bg-surface-container-high text-on-surface shadow-inner border border-white/10'
                        : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                    }`}
                  >
                    <span
                      className="material-symbols-outlined text-[1.125rem]"
                      style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                    >
                      {link.icon}
                    </span>
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>
          )}

          {/* Right Area: Streak & Action Button */}
          <div className="flex items-center gap-2 sm:gap-3">
            {pathname !== '/login' && (
              <>
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-low border border-tertiary/20 text-tertiary font-label-md text-xs shadow-[0_0_20px_rgba(255,185,95,0.15)]">
                  <span>🔥</span>
                  <span className="font-bold">
                    {streak > 0 ? `${streak} day${streak > 1 ? 's' : ''} logged` : '0 days logged'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('t1d-refresh-data'));
                  }}
                  title="Refresh from database"
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-surface-container-low hover:bg-surface-container border border-white/10 text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[1.125rem] text-primary">sync</span>
                </button>

                <button
                  onClick={() => {
                    if (onNewEntry) {
                      onNewEntry();
                    } else {
                      window.dispatchEvent(new CustomEvent('open-quick-log'));
                    }
                  }}
                  aria-label="New Entry"
                  title="New Entry"
                  className="flex items-center gap-1.5 px-3 h-10 rounded-full bg-primary-container text-on-primary font-body-md text-xs font-bold shadow-[0_10px_25px_-5px_rgba(16,185,129,0.35)] hover:bg-primary transition-all active:scale-95"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[1.125rem]">add</span>
                  <span>New</span>
                </button>
              </>
            )}

            {/* Profile Avatar / Login */}
            <Link
              href="/login"
              title={
                hasCloudSession
                  ? `Signed into cloud as ${settings?.display_name || 'User'} (${settings?.email || 'Google Account'})`
                  : 'Database connection inactive — tap to sign in with Google'
              }
              className="relative flex items-center justify-center p-0.5 rounded-full hover:ring-2 hover:ring-primary/40 transition-all"
            >
              <div className="w-8 h-8 rounded-full bg-surface-container-high border border-primary/30 flex items-center justify-center text-xs font-bold text-on-surface overflow-hidden">
                {settings?.display_name?.slice(0, 2).toUpperCase() || 'FL'}
              </div>
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-background ${
                  hasCloudSession ? 'bg-primary' : 'bg-outline/50'
                }`}
                title={hasCloudSession ? 'Cloud Synced' : 'Local / Offline Mode'}
              ></span>
            </Link>
          </div>
        </div>

      </header>
    </>
  );
}
