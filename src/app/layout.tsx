import type { Metadata } from 'next';
import { Syne, Manrope } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';
import { Navbar } from '@/components/Navbar';
import { Ambient } from '@/components/Ambient';
import { Toaster } from '@/components/ui/misc';
import { LocationGate } from '@/components/LocationGate';
import { Footer } from '@/components/Footer';
import { DemoBanner } from '@/components/DemoBanner';

const display = Syne({ subsets: ['latin'], variable: '--font-display', weight: ['500', '600', '700', '800'], display: 'swap' });
const body = Manrope({ subsets: ['latin'], variable: '--font-body', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'CineVerse — See your seat before you book', template: '%s · CineVerse' },
  description: 'Book cinema tickets with an interactive 3D seat map and a 180° preview of the view from your exact seat.',
  metadataBase: new URL(process.env.NEXTAUTH_URL || process.env.SITE_URL || 'http://localhost:3000'),
  openGraph: { type: 'website', siteName: 'CineVerse' },
  themeColor: '#04050a',
  viewport: { width: 'device-width', initialScale: 1 },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-screen font-sans">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-ink-950">Skip to content</a>
        <Providers>
          <Ambient />
          <Navbar />
          <main id="main">{children}</main>
          <Footer />
          <LocationGate />
          <DemoBanner />
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
