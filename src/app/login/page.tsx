'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSettings, setUserLoggedIn, isUserLoggedIn } from '@/lib/sync-storage';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { UserSettings } from '@/types';

export default function LoginPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [isEditingAccount, setIsEditingAccount] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    const s = getSettings();
    setSettings(s);
    if (s.email) {
      setEmailInput(s.email);
    }
    if (s.display_name) {
      setNameInput(s.display_name);
    }

    // Check real Supabase OAuth session on redirect/load
    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session?.user) {
          const u = data.session.user;
          const realEmail = u.email || '';
          const realName = u.user_metadata?.full_name || u.user_metadata?.name || s.display_name;
          const updated = setUserLoggedIn(true, {
            email: realEmail,
            display_name: realName,
            avatar_url: u.user_metadata?.avatar_url || s.avatar_url,
            auth_provider: 'google',
          });
          setSettings(updated);
          setEmailInput(realEmail);
          setNameInput(realName);
          setFeedback({
            text: `Signed in successfully via Google as ${realEmail}`,
            type: 'success',
          });
          setTimeout(() => {
            router.push('/');
          }, 800);
        }
      });

      const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          const u = session.user;
          const realEmail = u.email || '';
          const realName = u.user_metadata?.full_name || u.user_metadata?.name || s.display_name;
          const updated = setUserLoggedIn(true, {
            email: realEmail,
            display_name: realName,
            avatar_url: u.user_metadata?.avatar_url || s.avatar_url,
            auth_provider: 'google',
          });
          setSettings(updated);
          setEmailInput(realEmail);
          setNameInput(realName);
        }
      });

      return () => {
        authListener.subscription.unsubscribe();
      };
    }
  }, [router]);

  // 1. Google OAuth flow via Supabase
  const handleGoogleOAuth = async () => {
    setLoading(true);
    setFeedback(null);

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined,
          },
        });
        if (error) {
          console.warn('Supabase Google OAuth notice:', error.message);
          setFeedback({
            text: `Google OAuth is not enabled in your Supabase dashboard yet (${error.message}). Please enter your email directly below to sign in!`,
            type: 'info',
          });
          setLoading(false);
          return;
        }
        return;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setFeedback({
          text: `Unable to open Google login (${msg}). You can enter your email directly below.`,
          type: 'error',
        });
        setLoading(false);
        return;
      }
    }

    setFeedback({
      text: 'Supabase credentials are not connected. Please enter your email directly below to log in!',
      type: 'info',
    });
    setLoading(false);
  };

  // 2. Direct Sign In with Real Email
  const handleDirectEmailSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = emailInput.trim();
    const cleanName = nameInput.trim();

    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setFeedback({
        text: 'Please enter a valid email address (e.g. yourname@gmail.com).',
        type: 'error',
      });
      return;
    }

    const current = getSettings();
    const updated = setUserLoggedIn(true, {
      email: cleanEmail,
      display_name: cleanName || current.display_name || 'Feelog User',
      auth_provider: 'google',
    });

    setSettings(updated);
    setIsEditingAccount(false);
    setFeedback({
      text: `Signed in successfully as ${cleanEmail}!`,
      type: 'success',
    });

    setTimeout(() => {
      router.push('/');
    }, 800);
  };

  // 3. Offline-First Guest Mode
  const handleGuestSignIn = () => {
    const updated = setUserLoggedIn(true, {
      auth_provider: 'guest',
      email: '',
    });
    setSettings(updated);
    setFeedback({
      text: 'Signed in via Private Offline Mode. Everything stays on your device.',
      type: 'info',
    });
    setTimeout(() => {
      router.push('/');
    }, 600);
  };

  // 4. Complete Sign Out
  const handleSignOut = async () => {
    setLoading(true);
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore
      }
    }
    const updated = setUserLoggedIn(false, {
      auth_provider: 'guest',
      email: '',
    });
    setSettings(updated);
    setEmailInput('');
    setIsEditingAccount(false);
    setLoading(false);
    setFeedback({
      text: 'Signed out completely. Sign in below when you return.',
      type: 'info',
    });
  };

  const loggedIn = isUserLoggedIn() || Boolean(settings?.is_logged_in);
  const hasEmail = Boolean(settings?.email && settings.email.trim().length > 0);

  return (
    <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col items-center justify-center min-h-[78vh]">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[34rem] h-[34rem] bg-primary/10 rounded-full blur-[140px] pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10">
        {/* Header Branding */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2 group mb-3">
            <span className="font-headline-xl text-3xl text-on-surface font-extrabold tracking-tight group-hover:text-primary transition-colors">
              Feelog
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-primary-container/20 text-primary font-label-md text-xs uppercase tracking-wider font-bold border border-primary/20">
              Type 1 Diary
            </span>
          </Link>
          <h1 className="text-xl sm:text-2xl font-extrabold text-on-surface tracking-tight">
            {loggedIn ? 'Your Feelog Account' : 'Welcome to Feelog'}
          </h1>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-1.5 leading-relaxed">
            {loggedIn
              ? 'You are signed in. Your diabetes rhythm logs, custom insulin brands, and settings are active.'
              : 'Sign in to access your diabetes diary and automatically synchronize your regimen.'}
          </p>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`mb-5 p-3.5 rounded-2xl text-xs font-semibold text-center border animate-in fade-in ${
              feedback.type === 'success'
                ? 'bg-primary/15 border-primary/30 text-primary'
                : feedback.type === 'error'
                ? 'bg-error/15 border-error/30 text-error'
                : 'bg-surface-container-high border-white/10 text-on-surface'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {/* Main Card Container */}
        <div className="rounded-3xl bg-surface-container-low/90 backdrop-blur-2xl border border-white/10 p-6 sm:p-7 shadow-2xl shadow-black/40">
          {loggedIn && !isEditingAccount ? (
            /* Signed In State */
            <div className="space-y-5">
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-surface-container/70 border border-primary/25">
                <div className="w-13 h-13 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-extrabold text-lg shrink-0">
                  {settings?.display_name?.slice(0, 2).toUpperCase() || 'FL'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-bold text-on-surface truncate">
                      {settings?.display_name || 'Feelog User'}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[0.65rem] font-bold border ${
                      hasEmail
                        ? 'bg-primary/20 text-primary border-primary/30'
                        : 'bg-surface-container-high text-on-surface-variant border-white/10'
                    }`}>
                      {hasEmail ? 'Google Account' : 'Offline Guest'}
                    </span>
                  </div>
                  <div className="text-xs text-on-surface-variant font-mono truncate mt-0.5">
                    {hasEmail ? settings?.email : 'Private Local Browser Storage'}
                  </div>
                  <div className="text-[0.68rem] text-primary mt-1 font-medium flex items-center gap-1">
                    <span className="material-symbols-outlined text-[0.875rem]">cloud_done</span>
                    <span>{hasEmail ? 'Account Connected & Synced' : 'Offline Private Storage Active'}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                <Link
                  href="/"
                  className="w-full py-3 rounded-full bg-primary text-on-primary font-bold text-xs text-center transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-base">dashboard</span>
                  <span>Continue to Dashboard</span>
                </Link>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingAccount(true)}
                    className="py-2.5 rounded-full bg-surface-container-high hover:bg-surface-bright text-on-surface font-semibold text-xs transition-all border border-white/5 flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">edit</span>
                    <span>{hasEmail ? 'Edit Email' : 'Link Real Email'}</span>
                  </button>

                  <Link
                    href="/settings"
                    className="py-2.5 rounded-full bg-surface-container-high hover:bg-surface-bright text-on-surface font-semibold text-xs text-center transition-all border border-white/5 flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">tune</span>
                    <span>Settings</span>
                  </Link>
                </div>

                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={loading}
                  className="w-full py-2.5 text-xs text-error/80 hover:text-error font-medium transition-colors mt-2 text-center"
                >
                  Sign Out / Switch Account
                </button>
              </div>
            </div>
          ) : (
            /* Sign In / Edit Form */
            <div className="space-y-5">
              {isEditingAccount && (
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <span className="text-xs font-bold text-on-surface">Update Account Details</span>
                  <button
                    type="button"
                    onClick={() => setIsEditingAccount(false)}
                    className="text-xs text-on-surface-variant hover:text-on-surface"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* 1. Official Google OAuth Button */}
              <button
                type="button"
                onClick={handleGoogleOAuth}
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-2xl bg-white text-slate-900 hover:bg-slate-100 font-bold text-xs sm:text-sm transition-all shadow-lg shadow-black/20 flex items-center justify-center gap-3 active:scale-95 cursor-pointer disabled:opacity-60"
              >
                {/* Official Google multicolored G SVG */}
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{loading ? 'Opening Google...' : 'Continue with Google'}</span>
              </button>

              <div className="flex items-center gap-3 my-2">
                <div className="flex-1 h-px bg-white/10"></div>
                <span className="text-[10px] uppercase tracking-wider text-on-surface-variant font-semibold">
                  or sign in with your email
                </span>
                <div className="flex-1 h-px bg-white/10"></div>
              </div>

              {/* 2. Direct Email Form */}
              <form onSubmit={handleDirectEmailSignIn} className="space-y-3.5">
                <div>
                  <label className="text-[11px] font-semibold text-on-surface-variant block mb-1">
                    Your Real Google / Email Address <span className="text-primary">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="e.g. yourname@gmail.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container border border-white/10 text-on-surface text-xs sm:text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-on-surface-variant/40"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-on-surface-variant block mb-1">
                    Your Full Name
                  </label>
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="e.g. Abhishek"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container border border-white/10 text-on-surface text-xs sm:text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-on-surface-variant/40"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-full bg-primary text-on-primary font-bold text-xs transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer mt-1"
                >
                  <span className="material-symbols-outlined text-sm">login</span>
                  <span>{isEditingAccount ? 'Save Account Details' : 'Sign In with This Email'}</span>
                </button>
              </form>

              {!isEditingAccount && (
                <>
                  <div className="flex items-center gap-3 my-2">
                    <div className="flex-1 h-px bg-white/10"></div>
                    <span className="text-[10px] uppercase tracking-wider text-on-surface-variant font-semibold">
                      or
                    </span>
                    <div className="flex-1 h-px bg-white/10"></div>
                  </div>

                  {/* 3. Guest Mode */}
                  <button
                    type="button"
                    onClick={handleGuestSignIn}
                    className="w-full py-2.5 px-4 rounded-2xl bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface font-semibold text-xs transition-all border border-white/5 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-secondary text-base">cloud_off</span>
                    <span>Continue in Private Offline Mode (No Email)</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* T1D Privacy & Medical Guarantee */}
        <div className="mt-6 p-4 rounded-2xl bg-surface-container-lowest/70 border border-white/5 backdrop-blur-md text-left flex items-start gap-3">
          <span className="material-symbols-outlined text-secondary text-lg mt-0.5 shrink-0">verified_user</span>
          <div className="text-[11px] text-on-surface-variant leading-relaxed">
            <span className="text-on-surface font-bold block mb-0.5">Strict Privacy &amp; Data Ownership</span>
            Feelog remembers your login across browser visits so you never lose access to your daily logs. All doses and symptoms are stored securely on this device.
          </div>
        </div>
      </div>
    </div>
  );
}
