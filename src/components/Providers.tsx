'use client';
import { SessionProvider } from 'next-auth/react';
import { MotionConfig } from 'framer-motion';
import { useEffect, type ReactNode } from 'react';
import { useLocation } from '@/lib/store';
export function Providers({ children }: { children: ReactNode }) {
  // rehydrate persisted location after mount so server & first client render match
  useEffect(() => { useLocation.persist.rehydrate(); }, []);
  return <SessionProvider><MotionConfig reducedMotion="user">{children}</MotionConfig></SessionProvider>;
}
