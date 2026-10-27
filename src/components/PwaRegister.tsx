'use client';

import { useEffect } from 'react';

export default function PwaRegister() {
  useEffect(() => {
    // Global listener for ChunkLoadError / stale Next.js deployment chunks
    const handleGlobalError = (e: ErrorEvent) => {
      const msg = e.message || '';
      if (
        msg.includes('ChunkLoadError') ||
        msg.includes('Loading chunk') ||
        msg.includes('Failed to fetch RSC payload')
      ) {
        console.warn('ChunkLoadError detected. Performing clean page reload...');
        const lastReload = sessionStorage.getItem('t1d_last_chunk_reload');
        const now = Date.now();
        // Prevent infinite reload loops (minimum 8s interval)
        if (!lastReload || now - Number(lastReload) > 8000) {
          sessionStorage.setItem('t1d_last_chunk_reload', String(now));
          window.location.reload();
        }
      }
    };
    window.addEventListener('error', handleGlobalError);

    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      if (process.env.NODE_ENV === 'development') {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const reg of registrations) {
            reg.unregister();
          }
        });
        if ('caches' in window) {
          caches.keys().then((names) => {
            for (const name of names) caches.delete(name);
          });
        }
        return;
      }

      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            console.log('T1D Log ServiceWorker registration successful with scope: ', reg.scope);
          })
          .catch((err) => {
            console.warn('T1D Log ServiceWorker registration failed: ', err);
          });
      });
    }
    return () => {
      window.removeEventListener('error', handleGlobalError);
    };
  }, []);

  return null;
}
