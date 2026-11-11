'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cx } from '@/lib/format';
const NAV = [
  { href: '/admin', label: 'Overview' }, { href: '/admin/movies', label: 'Movies' }, { href: '/admin/theatres', label: 'Theatres & screens' },
  { href: '/admin/shows', label: 'Showtimes' }, { href: '/admin/bookings', label: 'Bookings' }, { href: '/admin/users', label: 'Users' },
];
export function AdminNav({ name }: { name: string }) {
  const p = usePathname();
  const [open, setOpen] = useState(false);
  const links = NAV.map((n) => {
    const active = n.href === '/admin' ? p === '/admin' : p?.startsWith(n.href) || (n.href === '/admin/theatres' && p?.startsWith('/admin/screens'));
    return <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className={cx('block rounded-xl px-3 py-2 text-sm transition', active ? 'bg-white/[0.08] text-white' : 'text-white/55 hover:bg-white/[0.04] hover:text-white')}>{n.label}</Link>;
  });
  return (
    <>
      <div className="glass-strong fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between px-4 lg:hidden">
        <span className="font-display font-bold">CineVerse <span className="text-white/40">Admin</span></span>
        <button onClick={() => setOpen((o) => !o)} className="chip" aria-expanded={open}>Menu</button>
      </div>
      {open && <div className="glass-strong fixed inset-x-0 top-14 z-40 space-y-1 p-3 lg:hidden">{links}</div>}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-white/[0.06] p-4 lg:flex">
        <Link href="/" className="mb-8 flex items-center gap-2 px-2"><span className="h-6 w-6 rounded-full bg-neon-gradient" /><span className="font-display font-bold">CineVerse</span><span className="rounded bg-white/10 px-1.5 text-[10px] uppercase tracking-wider text-white/60">Admin</span></Link>
        <nav className="space-y-1">{links}</nav>
        <div className="mt-auto rounded-2xl bg-white/[0.03] p-3 text-xs text-white/50">Signed in as<br /><span className="text-white/80">{name}</span><Link href="/" className="mt-2 block text-neon-violet">← Back to site</Link></div>
      </aside>
    </>
  );
}
