'use client';
import { SessionProvider } from 'next-auth/react';
import { MotionConfig } from 'framer-motion';
import { useEffect, type ReactNode } from 'react';
import { useLocation } from '@/lib/store';
import { DEMO } from '@/lib/mode';
export function Providers({ children }: { children: ReactNode }) {
  // rehydrate persisted location after mount so server & first client render match
  useEffect(() => { useLocation.persist.rehydrate(); }, []);
  const inner = <MotionConfig reducedMotion="user">{children}</MotionConfig>;
  // The Pages demo has no auth server; its session lives in the in-browser backend.
  return DEMO ? inner : <SessionProvider>{inner}</SessionProvider>;
}
