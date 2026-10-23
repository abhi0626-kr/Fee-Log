'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { isUserLoggedIn } from '@/lib/sync-storage';

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = () => {
      const loggedIn = isUserLoggedIn();

      // If user is NOT logged in and not already on /login, redirect to /login
      if (!loggedIn && pathname !== '/login') {
        setAuthorized(false);
        router.replace('/login');
        return;
      }

      setAuthorized(true);
    };

    checkAuth();

    // Listen for storage/login state changes across tabs or login events
    window.addEventListener('storage', checkAuth);
    window.addEventListener('t1d-data-updated', checkAuth);
    return () => {
      window.removeEventListener('storage', checkAuth);
      window.removeEventListener('t1d-data-updated', checkAuth);
    };
  }, [pathname, router]);

  // If on login page, always render children directly
  if (pathname === '/login') {
    return <>{children}</>;
  }

  // Initial client check pending or unauthenticated redirecting
  if (authorized === null || authorized === false) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <div className="w-12 h-12 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-black text-xl shadow-[0_0_20px_rgba(78,222,163,0.3)]">
            FL
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
            <span className="text-xs font-semibold text-on-surface-variant tracking-widest uppercase">
              Feelog
            </span>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
