'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppSession, appSignOut } from '@/lib/session';
import { routes } from '@/lib/routes';
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'framer-motion';
import { useState } from 'react';
import { useLocation } from '@/lib/store';
import { cx } from '@/lib/format';

const links = [{ href: '/', label: 'Discover' }, { href: '/movies', label: 'Movies' }, { href: '/theatres', label: 'Cinemas' }];

export function Navbar() {
  const path = usePathname();
  const { user } = useAppSession();
  const { location, openPicker } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, 'change', (v) => setScrolled(v > 24));
  const role = user?.role;
  if (path?.startsWith('/admin')) return null;

  return (
    <header className="no-print fixed inset-x-0 top-0 z-50">
      <div className={cx('container-x transition-all duration-500', scrolled ? 'pt-3' : 'pt-5')}>
        <nav className={cx('flex h-14 items-center gap-3 rounded-full px-3 pl-5 transition-all duration-500', scrolled ? 'glass-strong shadow-2xl' : 'bg-transparent')}>
          <Link href="/" className="flex items-center gap-2 focus-ring rounded-full" aria-label="CineVerse home">
            <span className="relative grid h-7 w-7 place-items-center rounded-full bg-neon-gradient shadow-glow"><span className="h-2.5 w-2.5 rounded-full bg-ink-950" /></span>
            <span className="hidden font-display text-lg font-bold tracking-tight min-[380px]:inline">Cine<span className="text-gradient">Verse</span></span>
          </Link>
          <div className="ml-6 hidden items-center gap-1 md:flex">
            {links.map((l) => {
              const active = l.href === '/' ? path === '/' : path?.startsWith(l.href);
              return (
                <Link key={l.href} href={l.href} className={cx('relative isolate rounded-full px-4 py-2 text-sm transition-colors focus-ring', active ? 'text-white' : 'text-white/55 hover:text-white')}>
                  {active && <motion.span layoutId="nav-pill" className="absolute inset-0 -z-10 rounded-full bg-white/[0.08]" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
                  {l.label}
                </Link>
              );
            })}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setMobileNav((v) => !v)} aria-label="Browse" aria-expanded={mobileNav} className="grid h-9 w-9 place-items-center rounded-full border border-white/10 md:hidden focus-ring">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M4 7h16M4 12h16M4 17h10" /></svg>
            </button>
            <button onClick={() => openPicker(true)} className="chip h-9 max-w-[120px] hover:border-white/25 focus-ring sm:max-w-[170px]" aria-label="Change location">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
              <span className="truncate">{location?.label ?? 'Set location'}</span>
            </button>
            {user ? (
              <div className="relative">
                <button onClick={() => setMenu((m) => !m)} className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-neon-violet to-neon-blue text-sm font-bold focus-ring" aria-label="Account menu" aria-expanded={menu}>
                  {(user.name || user.email || '?')[0].toUpperCase()}
                </button>
                <AnimatePresence>
                  {menu && (
                    <motion.div initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }} className="glass-strong absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl p-1.5 text-sm" onMouseLeave={() => setMenu(false)}>
                      <p className="truncate px-3 py-2 text-xs text-white/45">{user.email}</p>
                      <Link onClick={() => setMenu(false)} href="/account" className="block rounded-xl px-3 py-2 hover:bg-white/[0.07]">My tickets & profile</Link>
                      {role === 'admin' && <Link onClick={() => setMenu(false)} href="/admin" className="block rounded-xl px-3 py-2 hover:bg-white/[0.07]">Admin dashboard</Link>}
                      <button onClick={() => appSignOut()} className="block w-full rounded-xl px-3 py-2 text-left text-white/70 hover:bg-white/[0.07]">Sign out</button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Link href={routes.login(path || '/')} className="whitespace-nowrap rounded-full bg-white px-4 py-2 text-xs font-semibold text-ink-950 transition hover:bg-white/90 focus-ring">Sign in</Link>
            )}
          </div>
        </nav>
        <AnimatePresence>
          {mobileNav && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="glass-strong mt-2 grid grid-cols-3 gap-1 rounded-2xl p-1.5 md:hidden">
              {links.map((l) => <Link key={l.href} href={l.href} onClick={() => setMobileNav(false)} className={cx('rounded-xl px-3 py-2.5 text-center text-sm', (l.href === '/' ? path === '/' : path?.startsWith(l.href)) ? 'bg-white/10 text-white' : 'text-white/60')}>{l.label}</Link>)}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
