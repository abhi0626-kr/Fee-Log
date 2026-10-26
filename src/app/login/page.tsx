'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  getSettings,
  setUserLoggedIn,
  isUserLoggedIn,
  hydrateFromSupabase,
  flushOfflineQueue,
} from '@/lib/sync-storage';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { UserSettings } from '@/types';

export default function LoginPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [isEditingAccount, setIsEditingAccount] = useState(false);
  const [cloudUser, setCloudUser] = useState<{ id: string; email?: string; name?: string } | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    setMounted(true);
    const s = getSettings();
    setSettings(s);
    if (s.email) {
      setEmailInput(s.email);
    }
    if (s.display_name) {
      setNameInput(s.display_name);
    }

    const isOAuthRedirect =
      typeof window !== 'undefined' &&
      (window.location.hash.includes('access_token') ||
        window.location.search.includes('code=') ||
        sessionStorage.getItem('t1d_oauth_in_progress') === 'true');

    // Check real Supabase OAuth session on redirect/load
    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(async ({ data }) => {
        if (data.session?.user) {
          const u = data.session.user;
          const realEmail = u.email || '';
          const realName = u.user_metadata?.full_name || u.user_metadata?.name || s.display_name;
          setCloudUser({ id: u.id, email: realEmail, name: realName });
          const updated = setUserLoggedIn(true, {
            email: realEmail,
            display_name: realName,
            user_id: u.id,
            avatar_url: u.user_metadata?.avatar_url || s.avatar_url,
            auth_provider: 'google',
          });
          setSettings(updated);
          setEmailInput(realEmail);
          setNameInput(realName);

          // Hydrate user data from Supabase
          await hydrateFromSupabase(u.id);
          await flushOfflineQueue();

          if (isOAuthRedirect) {
            sessionStorage.removeItem('t1d_oauth_in_progress');
            setFeedback({
              text: `Signed in successfully as ${realEmail}! Redirecting...`,
              type: 'success',
            });
            setTimeout(() => {
              router.push('/');
            }, 800);
          }
        } else {
          setCloudUser(null);
        }
      });

      const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          const u = session.user;
          const realEmail = u.email || '';
          const realName = u.user_metadata?.full_name || u.user_metadata?.name || s.display_name;
          setCloudUser({ id: u.id, email: realEmail, name: realName });
          const updated = setUserLoggedIn(true, {
            email: realEmail,
            display_name: realName,
            user_id: u.id,
            avatar_url: u.user_metadata?.avatar_url || s.avatar_url,
            auth_provider: session.provider_token ? 'google' : 'email',
          });
          setSettings(updated);
          setEmailInput(realEmail);
          setNameInput(realName);

          await hydrateFromSupabase(u.id);
          await flushOfflineQueue();

          if (event === 'SIGNED_IN' && isOAuthRedirect) {
            sessionStorage.removeItem('t1d_oauth_in_progress');
            router.push('/');
          }
        } else {
          setCloudUser(null);
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
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('t1d_oauth_in_progress', 'true');
    }

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
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('t1d_oauth_in_progress');
          }
          setFeedback({
            text: `Google OAuth is not enabled in your Supabase dashboard yet (${error.message}). You can use Email & Password below!`,
            type: 'info',
          });
          setLoading(false);
          return;
        }
        return;
      } catch (err: unknown) {
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('t1d_oauth_in_progress');
        }
        const msg = err instanceof Error ? err.message : String(err);
        setFeedback({
          text: `Unable to open Google login (${msg}). You can sign in with Email & Password below.`,
          type: 'error',
        });
        setLoading(false);
        return;
      }
    }

    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('t1d_oauth_in_progress');
    }
    setFeedback({
      text: 'Supabase credentials are not connected.',
      type: 'info',
    });
    setLoading(false);
  };

  // 2. Email & Password Sign In
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = emailInput.trim();
    if (!cleanEmail || !passwordInput) {
      setFeedback({ text: 'Please enter both your email and password.', type: 'error' });
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setFeedback({ text: 'Supabase is not configured yet.', type: 'error' });
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: passwordInput,
      });

      if (error) {
        if (error.message.toLowerCase().includes('email not confirmed')) {
          setFeedback({
            text: 'Your email address is not confirmed yet. Please verify your email inbox or disable "Confirm email" in your Supabase dashboard (Authentication -> Providers -> Email).',
            type: 'error',
          });
        } else if (error.message.toLowerCase().includes('invalid login credentials')) {
          setFeedback({
            text: 'Invalid email or password. If you do not have an account yet, switch to "Create Account" below.',
            type: 'error',
          });
        } else {
          setFeedback({ text: error.message, type: 'error' });
        }
        setLoading(false);
        return;
      }

      if (data.user) {
        const u = data.user;
        const realName = u.user_metadata?.full_name || nameInput || 'Feelog User';
        const updated = setUserLoggedIn(true, {
          email: u.email || cleanEmail,
          display_name: realName,
          user_id: u.id,
          auth_provider: 'email',
        });
        setSettings(updated);
        setFeedback({
          text: `Signed in successfully as ${u.email}! Restoring your diabetes logs...`,
          type: 'success',
        });

        // Hydrate all logs from Supabase
        await hydrateFromSupabase(u.id);
        await flushOfflineQueue();

        setTimeout(() => {
          router.push('/');
        }, 800);
      }
    } catch (err) {
      setFeedback({
        text: `Sign in error: ${err instanceof Error ? err.message : String(err)}`,
        type: 'error',
      });
      setLoading(false);
    }
  };

  // 3. Email & Password Sign Up
  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = emailInput.trim();
    const cleanName = nameInput.trim();

    if (!cleanEmail || !passwordInput) {
      setFeedback({ text: 'Please enter both email and password.', type: 'error' });
      return;
    }

    if (passwordInput.length < 6) {
      setFeedback({ text: 'Password must be at least 6 characters long.', type: 'error' });
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setFeedback({ text: 'Supabase is not configured yet.', type: 'error' });
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: passwordInput,
        options: {
          data: {
            full_name: cleanName || 'Feelog User',
          },
        },
      });

      if (error) {
        setFeedback({ text: error.message, type: 'error' });
        setLoading(false);
        return;
      }

      if (data.session && data.user) {
        // Email confirmation is disabled; immediately signed in!
        const u = data.user;
        const updated = setUserLoggedIn(true, {
          email: u.email || cleanEmail,
          display_name: cleanName || 'Feelog User',
          user_id: u.id,
          auth_provider: 'email',
        });
        setSettings(updated);
        setFeedback({
          text: `Account created & signed in! Synchronizing your data...`,
          type: 'success',
        });

        await hydrateFromSupabase(u.id);
        await flushOfflineQueue();

        setTimeout(() => {
          router.push('/');
        }, 800);
      } else if (data.user) {
        // Confirmation email sent
        setFeedback({
          text: `Account created for ${cleanEmail}! Please check your email to confirm, or turn off "Confirm email" in your Supabase dashboard (Authentication -> Providers -> Email) to sign in instantly.`,
          type: 'info',
        });
        setAuthMode('signin');
        setLoading(false);
      }
    } catch (err) {
      setFeedback({
        text: `Sign up error: ${err instanceof Error ? err.message : String(err)}`,
        type: 'error',
      });
      setLoading(false);
    }
  };

  // 4. Offline-First Guest Mode
  const handleGuestSignIn = () => {
    const updated = setUserLoggedIn(true, {
      auth_provider: 'guest',
      email: '',
    });
    setSettings(updated);
    setFeedback({
      text: 'Signed in via Private Offline Mode. Everything stays on this browser.',
      type: 'info',
    });
    setTimeout(() => {
      router.push('/');
    }, 600);
  };

  // 5. Complete Sign Out
  const handleSignOut = async () => {
    setLoading(true);
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore
      }
    }
    setCloudUser(null);
    const updated = setUserLoggedIn(false, {
      auth_provider: 'guest',
      email: '',
      user_id: undefined,
      is_logged_in: false,
    });
    setSettings(updated);
    setEmailInput('');
    setPasswordInput('');
    setNameInput('');
    setIsEditingAccount(false);
    setLoading(false);
    setFeedback({
      text: 'Signed out completely. You can sign in anytime below.',
      type: 'info',
    });
  };

  // 0. Hydration Barrier: Render identical SSR & first-paint placeholder until mounted
  if (!mounted) {
    return (
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col items-center justify-center min-h-[78vh]">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[34rem] h-[34rem] bg-primary/10 rounded-full blur-[140px] pointer-events-none"></div>
        <div className="w-full max-w-md relative z-10">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 mb-3">
              <span className="font-headline-xl text-3xl text-on-surface font-extrabold tracking-tight">
                Feelog
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-primary-container/20 text-primary font-label-md text-xs uppercase tracking-wider font-bold border border-primary/20">
                Type 1 Diary
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-on-surface tracking-tight">
              Feelog Account
            </h1>
            <p className="text-xs sm:text-sm text-on-surface-variant mt-1.5 leading-relaxed">
              Verifying your account session...
            </p>
          </div>
          <div className="rounded-3xl bg-surface-container-low/90 backdrop-blur-2xl border border-white/10 p-8 shadow-2xl shadow-black/40 flex flex-col items-center justify-center py-14 gap-3">
            <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
            <span className="text-xs text-on-surface-variant font-medium">Loading session...</span>
          </div>
        </div>
      </div>
    );
  }

  const hasCloudSession = Boolean(cloudUser?.id);
  const isCloudConnected = isSupabaseConfigured ? hasCloudSession : isUserLoggedIn();
  const hasEmail = Boolean((cloudUser?.email || settings?.email || '').trim().length > 0);
  const activeEmail = cloudUser?.email || settings?.email;

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
            {isCloudConnected ? 'Your Feelog Account' : 'Welcome to Feelog'}
          </h1>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-1.5 leading-relaxed">
            {isCloudConnected
              ? 'You are signed in. Your doses, sensory logs, and history sync seamlessly with your database.'
              : 'Sign in to access your diabetes diary and synchronize all logs across devices & URLs.'}
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

        {/* Informational banner when local logs exist and cloud session is not active */}
        {!isCloudConnected && (
          <div className="mb-4 p-3 rounded-2xl bg-secondary-container/15 border border-secondary/30 text-on-surface text-xs leading-relaxed flex items-start gap-2.5">
            <span className="material-symbols-outlined text-secondary text-base shrink-0 mt-0.5">cloud_sync</span>
            <div>
              <span className="font-bold text-secondary block">Cloud Synchronization</span>
              Sign in with Google to automatically link and sync your local diabetes logs to your secure cloud database.
            </div>
          </div>
        )}

        {/* Main Card Container */}
        <div className="rounded-3xl bg-surface-container-low/90 backdrop-blur-2xl border border-white/10 p-6 sm:p-7 shadow-2xl shadow-black/40">
          {isCloudConnected && !isEditingAccount ? (
            /* Signed In State */
            <div className="space-y-5">
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-surface-container/70 border border-primary/25">
                <div className="w-13 h-13 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-extrabold text-lg shrink-0">
                  {(cloudUser?.name || settings?.display_name)?.slice(0, 2).toUpperCase() || 'FL'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-bold text-on-surface truncate">
                      {cloudUser?.name || settings?.display_name || 'Feelog User'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[0.65rem] font-bold border ${
                        hasEmail
                          ? 'bg-primary/20 text-primary border-primary/30'
                          : 'bg-surface-container-high text-on-surface-variant border-white/10'
                      }`}
                    >
                      {hasEmail ? 'Supabase Account' : 'Offline Guest'}
                    </span>
                  </div>
                  <div className="text-xs text-on-surface-variant font-mono truncate mt-0.5">
                    {hasEmail ? activeEmail : 'Private Local Browser Storage'}
                  </div>
                  <div className="text-[0.68rem] text-primary mt-1 font-medium flex items-center gap-1">
                    <span className="material-symbols-outlined text-[0.875rem]">cloud_done</span>
                    <span>Database Connected &amp; Synced</span>
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
                    onClick={async () => {
                      setLoading(true);
                      await hydrateFromSupabase();
                      const res = await flushOfflineQueue();
                      setLoading(false);
                      if (res.failed > 0) {
                        setFeedback({ text: res.errorMessage || 'Sync incomplete. Try again.', type: 'error' });
                      } else {
                        setFeedback({ text: 'Data refreshed & synchronized with Supabase!', type: 'success' });
                      }
                    }}
                    disabled={loading}
                    className="py-2.5 rounded-full bg-surface-container-high hover:bg-surface-bright text-on-surface font-semibold text-xs transition-all border border-white/5 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <span className={`material-symbols-outlined text-sm ${loading ? 'animate-spin' : ''}`}>sync</span>
                    <span>Sync Now</span>
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
                  className="w-full py-3 rounded-full bg-error/15 hover:bg-error/25 active:scale-95 text-error font-bold text-xs transition-all border border-error/30 flex items-center justify-center gap-2 cursor-pointer mt-1"
                >
                  <span className="material-symbols-outlined text-sm">logout</span>
                  <span>Sign Out / Switch Account</span>
                </button>
              </div>
            </div>
          ) : (
            /* Sign In / Sign Up Form */
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
                  or with email &amp; password
                </span>
                <div className="flex-1 h-px bg-white/10"></div>
              </div>

              {/* Mode Toggle Tabs: Sign In vs Create Account */}
              <div className="flex p-1 rounded-xl bg-surface-container border border-white/5">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signin');
                    setFeedback(null);
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    authMode === 'signin'
                      ? 'bg-primary-container text-on-primary shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signup');
                    setFeedback(null);
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    authMode === 'signup'
                      ? 'bg-primary-container text-on-primary shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  Create Account
                </button>
              </div>

              {/* 2. Supabase Email + Password Form */}
              <form
                onSubmit={authMode === 'signin' ? handleEmailSignIn : handleEmailSignUp}
                className="space-y-3.5"
              >
                {authMode === 'signup' && (
                  <div>
                    <label className="text-[11px] font-semibold text-on-surface-variant block mb-1">
                      Your Full Name
                    </label>
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder="e.g. Abhishek KR"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container border border-white/10 text-on-surface text-xs sm:text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-on-surface-variant/40"
                    />
                  </div>
                )}

                <div>
                  <label className="text-[11px] font-semibold text-on-surface-variant block mb-1">
                    Email Address <span className="text-primary">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="e.g. abhishek636kr@gmail.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container border border-white/10 text-on-surface text-xs sm:text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-on-surface-variant/40"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-on-surface-variant block mb-1">
                    Password <span className="text-primary">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Enter your password (min 6 characters)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container border border-white/10 text-on-surface text-xs sm:text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-on-surface-variant/40"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-full bg-primary text-on-primary font-bold text-xs transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer mt-1 disabled:opacity-60"
                >
                  <span className={`material-symbols-outlined text-sm ${loading ? 'animate-spin' : ''}`}>
                    {loading ? 'sync' : authMode === 'signin' ? 'login' : 'person_add'}
                  </span>
                  <span>
                    {loading
                      ? 'Authenticating...'
                      : authMode === 'signin'
                      ? 'Sign In with Password'
                      : 'Create Account & Sync'}
                  </span>
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
                    <span>Continue in Private Offline Mode (No Account)</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* T1D Privacy & Database Guarantee */}
        <div className="mt-6 p-4 rounded-2xl bg-surface-container-lowest/70 border border-white/5 backdrop-blur-md text-left flex items-start gap-3">
          <span className="material-symbols-outlined text-secondary text-lg mt-0.5 shrink-0">verified_user</span>
          <div className="text-[11px] text-on-surface-variant leading-relaxed">
            <span className="text-on-surface font-bold block mb-0.5">Cloud Database Sync &amp; Privacy</span>
            Feelog encrypts and locks all your diabetes rhythm logs to your individual Supabase user account via Row-Level Security (RLS). You can access your complete logs from any browser or phone by logging in.
          </div>
        </div>
      </div>
    </div>
  );
}
