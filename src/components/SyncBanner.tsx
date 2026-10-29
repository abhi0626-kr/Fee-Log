'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  getOfflineQueue,
  flushOfflineQueue,
  getIsOnline,
  hydrateFromSupabase,
  clearOfflineQueue,
  hasActiveCloudSession,
  initSupabaseRealtime,
} from '@/lib/sync-storage';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export default function SyncBanner() {
  const router = useRouter();
  const [online, setOnline] = useState(true);
  const [queueCount, setQueueCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSyncedNotice, setShowSyncedNotice] = useState(false);
  const [syncedNoticeText, setSyncedNoticeText] = useState('Synced to database ✓');
  const [hasCloudSession, setHasCloudSession] = useState(false);

  const checkSession = useCallback(async () => {
    const active = await hasActiveCloudSession();
    setHasCloudSession(active);
    return active;
  }, []);

  const doSync = useCallback(async () => {
    const q = getOfflineQueue();
    if (q.length === 0) {
      setQueueCount(0);
      return;
    }

    const hasSession = await checkSession();
    if (!hasSession && isSupabaseConfigured) {
      // Prompt user to sign in
      return;
    }

    setIsSyncing(true);
    const res = await flushOfflineQueue();
    setIsSyncing(false);

    const remaining = getOfflineQueue();
    setQueueCount(remaining.length);

    if (res.synced > 0) {
      setSyncedNoticeText(
        res.synced === 1 ? '1 log synced to database ✓' : `${res.synced} logs synced to database ✓`
      );
      setShowSyncedNotice(true);
      setTimeout(() => setShowSyncedNotice(false), 3000);
    }
  }, [checkSession]);

  useEffect(() => {
    setOnline(getIsOnline());
    const q = getOfflineQueue();
    setQueueCount(q.length);
    checkSession().then((hasSession) => {
      if (hasSession) {
        hydrateFromSupabase().catch((error) => {
          console.error('Unable to load logs from database:', error);
        });
      }
    });

    const handleOnline = () => {
      setOnline(true);
      checkSession().then((hasSession) => {
        if (hasSession) {
          doSync();
        }
      });
    };

    const handleOffline = () => {
      setOnline(false);
    };

    const handleDataUpdated = () => {
      setQueueCount(getOfflineQueue().length);
      checkSession();
    };

    const handleTriggerSync = () => {
      if (getIsOnline()) {
        doSync();
      }
    };

    const handleRefreshData = () => {
      if (getIsOnline()) {
        hydrateFromSupabase().catch((error) => {
          console.error('Unable to refresh logs from database:', error);
        });
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('storage', handleDataUpdated);
    window.addEventListener('t1d-data-updated', handleDataUpdated);
    window.addEventListener('t1d-quick-sync', handleTriggerSync);
    window.addEventListener('t1d-refresh-data', handleRefreshData);

    let authUnsubscribe: (() => void) | undefined;
    let realtimeUnsubscribe: (() => void) | undefined;

    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session?.user) {
          realtimeUnsubscribe = initSupabaseRealtime(data.session.user.id);
        }
      });

      const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
        const hasUser = Boolean(session?.user);
        setHasCloudSession(hasUser);
        if (hasUser && session?.user) {
          if (realtimeUnsubscribe) realtimeUnsubscribe();
          realtimeUnsubscribe = initSupabaseRealtime(session.user.id);
          hydrateFromSupabase(session.user.id).catch((error) => {
            console.error('Unable to load logs after sign-in:', error);
          });
          flushOfflineQueue().catch((error) => {
            console.error('Unable to retry pending logs after sign-in:', error);
          });
        }
      });
      authUnsubscribe = () => authListener.subscription.unsubscribe();
    }

    const interval = setInterval(() => {
      const currentQueue = getOfflineQueue();
      setQueueCount(currentQueue.length);
      if (currentQueue.length > 0 && getIsOnline()) {
        checkSession().then((hasSession) => {
          if (hasSession) {
            doSync();
          }
        });
      }
    }, 3000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('storage', handleDataUpdated);
      window.removeEventListener('t1d-data-updated', handleDataUpdated);
      window.removeEventListener('t1d-quick-sync', handleTriggerSync);
      window.removeEventListener('t1d-refresh-data', handleRefreshData);
      if (authUnsubscribe) authUnsubscribe();
      if (realtimeUnsubscribe) realtimeUnsubscribe();
      clearInterval(interval);
    };
  }, [doSync, checkSession]);

  const handleBannerClick = () => {
    if (!hasCloudSession && isSupabaseConfigured) {
      router.push('/login');
    } else {
      doSync();
    }
  };

  const handleDismissQueue = (e: React.MouseEvent) => {
    e.stopPropagation();
    clearOfflineQueue();
    setQueueCount(0);
  };

  if (showSyncedNotice) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[60] bg-primary-container text-on-primary text-xs px-3 py-1 flex items-center justify-center gap-1.5 font-bold transition-all shadow-md">
        <span className="material-symbols-outlined text-[14px]">check_circle</span>
        <span>{syncedNoticeText}</span>
      </div>
    );
  }

  if (!online) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[60] bg-tertiary-container text-on-tertiary-container text-xs px-3 py-1 flex items-center justify-center gap-1.5 font-medium shadow-md">
        <span className="material-symbols-outlined text-[14px]">wifi_off</span>
        <span>Offline — database writes are unavailable until you reconnect</span>
      </div>
    );
  }

  if (queueCount > 0) {
    const isUnauthenticated = !hasCloudSession && isSupabaseConfigured;

    return (
      <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-1 max-w-[calc(100%-1rem)] animate-in fade-in slide-in-from-top-1">
        <button
          type="button"
          onClick={handleBannerClick}
          className="rounded-full bg-secondary-container hover:bg-secondary text-on-secondary-container hover:text-on-secondary text-xs px-3.5 py-1.5 flex items-center justify-center gap-1.5 font-bold transition-all cursor-pointer shadow-lg active:scale-95"
          title={
            isUnauthenticated
              ? 'Click to sign in with Google and sync your local updates to your account'
              : 'Tap to sync pending updates now'
          }
        >
          <span className={`material-symbols-outlined text-[14px] ${isSyncing ? 'animate-spin' : ''}`}>
            {isUnauthenticated ? 'cloud_off' : 'sync'}
          </span>
          <span>
            {isSyncing
              ? 'Syncing data...'
              : isUnauthenticated
              ? `${queueCount} local update${queueCount > 1 ? 's' : ''} saved — tap to sign in & sync`
              : `${queueCount} local update${queueCount > 1 ? 's' : ''} pending — tap to sync`}
          </span>
        </button>

        {isUnauthenticated && (
          <button
            type="button"
            onClick={handleDismissQueue}
            className="w-7 h-7 rounded-full bg-surface-container-high/90 hover:bg-surface-bright text-on-surface-variant hover:text-on-surface flex items-center justify-center text-xs shadow-md border border-white/10 transition-colors"
            title="Keep updates stored locally and dismiss this banner"
          >
            <span className="material-symbols-outlined text-[13px]">close</span>
          </button>
        )}
      </div>
    );
  }

  return null;
}
