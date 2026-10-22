'use client';

import { useEffect } from 'react';

export default function PwaRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
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
