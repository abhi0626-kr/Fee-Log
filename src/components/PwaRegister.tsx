'use client';

import { useEffect } from 'react';

export default function PwaRegister() {
  useEffect(() => {
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
  }, []);

  return null;
}
