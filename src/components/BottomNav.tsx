'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarDays,
  Clock,
  Sparkles,
  BarChart3,
  FileDown,
  Settings as SettingsIcon,
} from 'lucide-react';

export default function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'Today', icon: CalendarDays },
    { href: '/timeline', label: 'Timeline', icon: Clock },
    { href: '/patterns', label: 'Patterns', icon: Sparkles },
    { href: '/summary', label: 'Summary', icon: BarChart3 },
    { href: '/export', label: 'Export', icon: FileDown },
    { href: '/settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-safe">
      <div className="max-w-md mx-auto flex items-center justify-around px-2 py-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all min-h-[48px] min-w-[44px] ${
                isActive
                  ? 'text-teal-600 dark:text-teal-400 font-semibold scale-105'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-[1.8px]'}`} />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-teal-600 dark:bg-teal-400 rounded-full" />
                )}
              </div>
              <span className="text-[10px] mt-1 tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
