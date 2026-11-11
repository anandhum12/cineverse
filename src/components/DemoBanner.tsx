'use client';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { DEMO } from '@/lib/mode';
import { loadDemo } from '@/lib/demo/lazy';
import { cx } from '@/lib/format';

/** Shown only in the GitHub Pages build: makes clear that data is local and payments are simulated. */
export function DemoBanner() {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  if (!DEMO) return null;
  const reset = async () => {
    if (!confirm('Reset the demo? This clears your bookings, sign-in and admin changes in this browser.')) return;
    (await loadDemo()).demo.reset();
    window.location.href = `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/`;
  };
  return (
    <div className={cx('no-print fixed bottom-4 left-4 z-30', path?.startsWith('/book') && 'hidden lg:block')}>
      {open ? (
        <div className="glass-strong max-w-xs rounded-2xl p-4 text-xs text-white/70 shadow-2xl">
          <p className="font-semibold text-white">Static demo on GitHub Pages</p>
          <p className="mt-1.5">There&apos;s no server: your bookings, sign-in and admin changes are saved only in this browser. Payments are simulated and no money moves. Sign in as <b>demo@cineverse.dev</b> / <b>demo1234</b>, or <b>admin@cineverse.dev</b> / <b>admin123</b>.</p>
          <div className="mt-3 flex gap-2"><button onClick={reset} className="chip">Reset demo data</button><button onClick={() => setOpen(false)} className="chip">Close</button></div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="chip glass-strong h-8 border-amber-300/30 text-amber-100">Demo · data stays in this browser</button>
      )}
    </div>
  );
}
