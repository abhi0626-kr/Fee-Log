import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import BottomNav from '@/components/BottomNav';
import SyncBanner from '@/components/SyncBanner';
import PwaRegister from '@/components/PwaRegister';

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
});

const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
});

export const metadata: Metadata = {
  title: 'T1D Log — Personal Type 1 Diabetes Tracker',
  description:
    'Fast mobile-first Type 1 Diabetes logging and deterministic pattern finder for meals, insulin, activity, and symptoms.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'T1D Log',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0d9488',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icon.svg" />
      </head>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans`}
      >
        <PwaRegister />
        <SyncBanner />
        <main className="flex-1 w-full">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
