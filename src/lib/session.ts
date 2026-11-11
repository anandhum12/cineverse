'use client';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useSyncExternalStore } from 'react';
import { DEMO } from './mode';
import { loadDemo, loadedDemo } from './demo/lazy';

export interface AppUser { id: string; name: string; email: string; role: 'user' | 'admin' }
export interface AppSession { status: 'loading' | 'authenticated' | 'unauthenticated'; user: AppUser | null }

const subscribe = (cb: () => void) => {
  let off = () => {};
  let live = true;
  loadDemo().then((m) => { if (live) { off = m.demo.subscribe(cb); cb(); } });
  return () => { live = false; off(); };
};
const LOADING: unique symbol = Symbol('loading');
const serverSnap = (): typeof LOADING => LOADING;
function useDemoSession(): AppSession {
  const u = useSyncExternalStore(subscribe, () => { const d = loadedDemo(); return d ? d.currentUser() : LOADING; }, serverSnap);
  if (u === LOADING) return { status: 'loading', user: null };
  return { status: u ? 'authenticated' : 'unauthenticated', user: u };
}
function useAuthSession(): AppSession {
  const { data, status } = useSession();
  const u = data?.user as Partial<AppUser> | undefined;
  return { status, user: u ? { id: u.id ?? '', name: u.name ?? '', email: u.email ?? '', role: u.role ?? 'user' } : null };
}

/** DEMO is a build-time constant, so a given build always calls the same hook. */
export const useAppSession: () => AppSession = DEMO ? useDemoSession : useAuthSession;

export async function appSignIn(email: string, password: string): Promise<string | null> {
  if (DEMO) return (await loadDemo()).demo.login(email, password);
  const r = await signIn('credentials', { email, password, redirect: false });
  return r?.error ? 'Incorrect email or password.' : null;
}

export async function appSignOut() {
  if (DEMO) { (await loadDemo()).demo.logout(); window.location.href = `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/`; return; }
  await signOut({ callbackUrl: '/' });
}

export { signIn as nextAuthSignIn };
