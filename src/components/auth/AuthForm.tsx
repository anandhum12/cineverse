'use client';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../ui/Button';
import { api } from '@/lib/client';

export function AuthForm({ mode, google }: { mode: 'login' | 'register'; google: boolean }) {
  const params = useSearchParams();
  const raw = params.get('next') || '/';
  const next = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/'; // no open redirects
  const router = useRouter();
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null); setBusy(true);
    try {
      if (mode === 'register') await api('/api/auth/register', { method: 'POST', json: f });
      const r = await signIn('credentials', { email: f.email, password: f.password, redirect: false });
      if (r?.error) throw new Error('Incorrect email or password.');
      router.replace(next); router.refresh();
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };

  return (
    <div className="container-x grid min-h-[100svh] place-items-center pb-16 pt-28">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass relative w-full max-w-md overflow-hidden rounded-[2rem] p-7 sm:p-9">
        <div aria-hidden className="absolute -right-24 -top-24 h-60 w-60 rounded-full bg-neon-violet/30 blur-3xl" />
        <h1 className="relative font-display text-3xl font-bold">{mode === 'login' ? 'Welcome back' : 'Create account'}</h1>
        <p className="relative mt-1 text-sm text-white/55">{mode === 'login' ? 'Sign in to book seats and see your tickets.' : 'Book faster and keep every ticket in one place.'}</p>
        {google && (
          <>
            <button onClick={() => signIn('google', { callbackUrl: next })} className="relative mt-6 flex h-12 w-full items-center justify-center gap-3 rounded-full bg-white text-sm font-semibold text-ink-950 transition hover:bg-white/90 focus-ring">
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>
              Continue with Google
            </button>
            <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-white/30"><span className="h-px flex-1 bg-white/10" />or<span className="h-px flex-1 bg-white/10" /></div>
          </>
        )}
        <form onSubmit={submit} className={`relative space-y-4 ${google ? '' : 'mt-6'}`}>
          {mode === 'register' && <label className="block"><span className="label">Name</span><input required minLength={2} className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" /></label>}
          <label className="block"><span className="label">Email</span><input required type="email" className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" /></label>
          <label className="block"><span className="label">Password</span><input required type="password" minLength={mode === 'register' ? 8 : 1} className="input" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />{mode === 'register' && <span className="mt-1 block text-[11px] text-white/35">At least 8 characters</span>}</label>
          {err && <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-200" role="alert">{err}</p>}
          <Button type="submit" size="lg" className="w-full" loading={busy}>{mode === 'login' ? 'Sign in' : 'Create account'}</Button>
        </form>
        <p className="relative mt-6 text-center text-sm text-white/50">
          {mode === 'login' ? <>New here? <Link className="text-white underline" href={`/register?next=${encodeURIComponent(next)}`}>Create an account</Link></> : <>Have an account? <Link className="text-white underline" href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link></>}
        </p>
        {mode === 'login' && process.env.NODE_ENV !== 'production' && <p className="relative mt-4 rounded-xl bg-white/[0.03] p-3 text-center text-[11px] text-white/40">Demo: demo@cineverse.dev / demo1234 · Admin: admin@cineverse.dev / admin123</p>}
      </motion.div>
    </div>
  );
}
