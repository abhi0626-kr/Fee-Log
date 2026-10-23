'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  getOfflineQueue,
  flushOfflineQueue,
  getIsOnline,
  hydrateFromServerDatabase,
} from '@/lib/sync-storage';

export default function SyncBanner() {
  const [online, setOnline] = useState(true);
  const [queueCount, setQueueCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSyncedNotice, setShowSyncedNotice] = useState(false);

  const doSync = useCallback(async () => {
    const q = getOfflineQueue();
    if (q.length === 0) {
      setQueueCount(0);
      return;
    }

    setIsSyncing(true);
    const res = await flushOfflineQueue();
    setIsSyncing(false);

    const remaining = getOfflineQueue();
    setQueueCount(remaining.length);

    if (res.synced > 0) {
      setShowSyncedNotice(true);
      setTimeout(() => setShowSyncedNotice(false), 3000);
    }
  }, []);

  useEffect(() => {
    setOnline(getIsOnline());
    const q = getOfflineQueue();
    setQueueCount(q.length);

    // Initial server hydration & sync
    hydrateFromServerDatabase().then(() => {
      if (q.length > 0 && getIsOnline()) {
        doSync();
      }
    });

    const handleOnline = () => {
      setOnline(true);
      doSync();
    };

    const handleOffline = () => {
      setOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const interval = setInterval(() => {
      const currentQueue = getOfflineQueue();
      setQueueCount(currentQueue.length);
      if (currentQueue.length > 0 && getIsOnline()) {
        doSync();
      }
    }, 4000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [doSync]);

  if (showSyncedNotice) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[60] bg-primary-container text-on-primary text-xs px-3 py-1 flex items-center justify-center gap-1.5 font-bold transition-all shadow-md">
        <span className="material-symbols-outlined text-[14px]">check_circle</span>
        <span>Synced to database ✓</span>
      </div>
    );
  }

  if (!online) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[60] bg-tertiary-container text-on-tertiary-container text-xs px-3 py-1 flex items-center justify-center gap-1.5 font-medium shadow-md">
        <span className="material-symbols-outlined text-[14px]">wifi_off</span>
        <span>Offline mode — logs saved locally and will sync when connected</span>
      </div>
    );
  }

  if (queueCount > 0) {
    return (
      <button
        type="button"
        onClick={() => doSync()}
        className="fixed top-2 left-1/2 -translate-x-1/2 z-[60] w-max max-w-[calc(100%-1rem)] rounded-full bg-secondary-container text-on-secondary-container text-xs px-3 py-1.5 flex items-center justify-center gap-1.5 font-bold transition-colors cursor-pointer shadow-md"
      >
        <span className={`material-symbols-outlined text-[14px] ${isSyncing ? 'animate-spin' : ''}`}>
          sync
        </span>
        <span>{isSyncing ? 'Syncing data...' : `${queueCount} local updates pending — tap to sync`}</span>
      </button>
    );
  }

  return null;
}
