'use client';
import { useEffect, useState } from 'react';
import { cx } from '@/lib/format';

export function useCountdown(expiresAt: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { if (!expiresAt) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [expiresAt]);
  return expiresAt ? Math.max(0, Math.floor((expiresAt - now) / 1000)) : null;
}

export function HoldTimer({ expiresAt, label = 'Seats held for' }: { expiresAt: number | null; label?: string }) {
  const left = useCountdown(expiresAt);
  if (left == null) return null;
  const m = Math.floor(left / 60), s = left % 60;
  const urgent = left < 60;
  return (
    <div className={cx('flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold tabular-nums', urgent ? 'bg-rose-500/15 text-rose-200' : 'bg-amber-400/10 text-amber-200')} role="timer" aria-live={urgent ? 'assertive' : 'off'}>
      <span className={cx('h-1.5 w-1.5 rounded-full', urgent ? 'animate-pulse bg-rose-400' : 'bg-amber-300')} />
      {left === 0 ? 'Hold expired' : `${label} ${m}:${String(s).padStart(2, '0')}`}
    </div>
  );
}
