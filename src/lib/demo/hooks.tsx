'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Data } from '../types';
import { loadDemo } from './lazy';
import { useAppSession } from '../session';
import { routes } from '../routes';
import { Skeleton } from '@/components/ui/misc';

/** Read from the in-browser store and re-render on every change. Selectors must return fresh objects. */
export function useDemoData<T>(select: (d: Readonly<Data>) => T): T | null {
  const [v, setV] = useState<T | null>(null);
  const sel = useRef(select);
  sel.current = select;
  useEffect(() => {
    let off = () => {};
    let live = true;
    loadDemo().then((m) => {
      if (!live) return;
      const pull = () => setV(sel.current(m.demo.data()));
      pull();
      off = m.demo.subscribe(pull);
    });
    return () => { live = false; off(); };
  }, []);
  return v;
}

export const PageSkeleton = () => <div className="container-x pt-32"><Skeleton className="h-10 w-72" /><Skeleton className="mt-6 h-[60vh] w-full !rounded-3xl" /></div>;

/** Client-side guard for signed-in (or admin) pages in the static demo. */
export function RequireUser({ admin, children }: { admin?: boolean; children: ReactNode }) {
  const { status, user } = useAppSession();
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const ok = status === 'authenticated' && (!admin || user?.role === 'admin');
  useEffect(() => {
    if (status === 'unauthenticated') router.replace(routes.login(`${path}${sp.toString() ? `?${sp}` : ''}`));
    else if (status === 'authenticated' && admin && user?.role !== 'admin') router.replace('/');
  }, [status, admin, user, router, path, sp]);
  return ok ? <>{children}</> : <PageSkeleton />;
}
