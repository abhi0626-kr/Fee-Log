'use client';

import React, { useState, useEffect } from 'react';
import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { getOfflineQueue, flushOfflineQueue, getIsOnline } from '@/lib/sync-storage';

export default function SyncBanner() {
  const [online, setOnline] = useState(true);
  const [queueCount, setQueueCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSyncedNotice, setShowSyncedNotice] = useState(false);

  const checkQueue = () => {
    const q = getOfflineQueue();
    setQueueCount(q.length);
  };

  useEffect(() => {
    setOnline(getIsOnline());
    checkQueue();

    const handleOnline = async () => {
      setOnline(true);
      setIsSyncing(true);
      const res = await flushOfflineQueue();
      setIsSyncing(false);
      checkQueue();
      if (res.synced > 0) {
        setShowSyncedNotice(true);
        setTimeout(() => setShowSyncedNotice(false), 3000);
      }
    };

    const handleOffline = () => {
      setOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const interval = setInterval(checkQueue, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  if (showSyncedNotice) {
    return (
      <div className="bg-emerald-500 text-white text-xs px-3 py-1.5 flex items-center justify-center gap-1.5 font-medium transition-all">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Synced offline logs to cloud
      </div>
    );
  }

  if (!online) {
    return (
      <div className="bg-amber-600 text-white text-xs px-3 py-1.5 flex items-center justify-center gap-1.5 font-medium">
        <WifiOff className="w-3.5 h-3.5" />
        Offline mode — logs saved locally and will sync when connected
      </div>
    );
  }

  if (queueCount > 0) {
    return (
      <div className="bg-blue-600 text-white text-xs px-3 py-1.5 flex items-center justify-center gap-1.5 font-medium">
        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
        {queueCount} log{queueCount > 1 ? 's' : ''} queued locally
      </div>
    );
  }

  return null;
}
