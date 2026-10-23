'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';
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
      <div className="bg-emerald-600 text-white text-xs px-3 py-1.5 flex items-center justify-center gap-1.5 font-bold transition-all shadow-sm">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Synced to database ✓
      </div>
    );
  }

  if (!online) {
    return (
      <div className="bg-amber-600 text-white text-xs px-3 py-1.5 flex items-center justify-center gap-1.5 font-medium shadow-sm">
        <WifiOff className="w-3.5 h-3.5" />
        Offline mode — logs saved locally and will sync when connected
      </div>
    );
  }

  if (queueCount > 0) {
    return (
      <button
        type="button"
        onClick={() => doSync()}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 flex items-center justify-center gap-1.5 font-medium transition-colors cursor-pointer"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
        <span>
          {isSyncing
            ? 'Saving to database...'
            : `${queueCount} log${queueCount > 1 ? 's' : ''} queued — tap to sync now`}
        </span>
      </button>
    );
  }

  return null;
}
