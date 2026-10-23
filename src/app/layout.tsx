import type { Metadata, Viewport } from 'next';
import './globals.css';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import SyncBanner from '@/components/SyncBanner';
import PwaRegister from '@/components/PwaRegister';
import AuthGuard from '@/components/AuthGuard';

export const metadata: Metadata = {
  title: 'Feelog — Mindful Type 1 Diabetes Companion',
  description:
    'Calm, non-judgmental, ultra-rapid symptom & rhythm diary for Type 1 Diabetes in Bangalore PG lifestyle.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Feelog',
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
  themeColor: '#0b1326',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="apple-touch-icon" href="/icon.svg" />
      </head>
      <body
        suppressHydrationWarning
        className="bg-background text-on-surface antialiased min-h-screen relative selection:bg-primary-container selection:text-on-primary flex flex-col font-sans"
      >
        {/* Fixed Ambient Mesh Orbs */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute -top-40 left-1/4 w-[48rem] h-[48rem] bg-[#0f766e]/15 rounded-full blur-[140px]"></div>
          <div className="absolute top-1/3 -right-32 w-[40rem] h-[40rem] bg-[#1e1b4b]/25 rounded-full blur-[160px]"></div>
          <div className="absolute -bottom-20 left-10 w-[36rem] h-[36rem] bg-[#083344]/20 rounded-full blur-[130px]"></div>
        </div>

        <PwaRegister />
        <SyncBanner />
        <Header />

        <main className="relative z-10 w-full pt-28 pb-20 md:pb-12 flex-1">
          <AuthGuard>{children}</AuthGuard>
        </main>

        <BottomNav />
      </body>
    </html>
  );
}
