import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { Inter } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/Sidebar';
import MobileTabBar from '@/components/MobileTabBar';
import { RanchProvider } from '@/components/auth/RanchProvider';
import { ACTIVE_RANCH_COOKIE, getAccessibleRanches, getActiveRanch } from '@/lib/supabase/ranch';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'PastureMap',
  description: 'Grazing rotation planner for rotational ranching',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [ranches, activeRanchState] = await Promise.all([
    getAccessibleRanches(),
    getActiveRanch(),
  ]);
  const cookieStore = await cookies();

  if (activeRanchState.shouldPersistCookie) {
    if (activeRanchState.activeRanch) {
      cookieStore.set(ACTIVE_RANCH_COOKIE, activeRanchState.activeRanch.ranchId, {
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 365,
      });
    } else {
      cookieStore.delete(ACTIVE_RANCH_COOKIE);
    }
  }

  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} bg-[#0e0f0f] text-white antialiased`}>
        <RanchProvider ranches={ranches} activeRanch={activeRanchState.activeRanch}>
          <div className="flex flex-col md:flex-row h-dvh overflow-hidden">
            <Sidebar />
            <main className="flex-1 min-h-0 overflow-auto bg-[#0e0f0f]">{children}</main>
            <MobileTabBar />
          </div>
        </RanchProvider>
      </body>
    </html>
  );
}
