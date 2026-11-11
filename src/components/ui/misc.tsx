'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, type ReactNode } from 'react';
import { cx } from '@/lib/format';
import { useToasts } from '@/lib/store';

export function Glass({ children, className, strong }: { children: ReactNode; className?: string; strong?: boolean }) {
  return <div className={cx(strong ? 'glass-strong' : 'glass', 'rounded-3xl', className)}>{children}</div>;
}

export function Skeleton({ className }: { className?: string }) { return <div className={cx('skeleton', className)} aria-hidden />; }

export function Stars({ value, size = 12 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-amber-300" aria-label={`Rated ${value} out of 10`}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z" /></svg>
      <span className="font-semibold tabular-nums">{value.toFixed(1)}</span>
    </span>
  );
}

export function Modal({ open, onClose, children, className, label }: { open: boolean; onClose: () => void; children: ReactNode; className?: string; label: string }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = prev; };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div role="dialog" aria-modal="true" aria-label={label}
            className={cx('glass-strong relative max-h-[92vh] w-full overflow-auto rounded-t-3xl p-6 sm:max-w-lg sm:rounded-3xl', className)}
            initial={{ y: 40, scale: 0.97, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: 30, scale: 0.98, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
            <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white focus-ring">✕</button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.button key={t.id} onClick={() => dismiss(t.id)} layout initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className={cx('glass-strong pointer-events-auto max-w-md rounded-2xl px-5 py-3 text-left text-sm shadow-2xl', t.kind === 'error' && 'border-rose-400/40 text-rose-100', t.kind === 'success' && 'border-emerald-400/40 text-emerald-100')}>
            {t.text}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, className }: { value: T; options: { id: T; label: ReactNode }[]; onChange: (v: T) => void; className?: string }) {
  return (
    <div role="tablist" className={cx('relative inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1', className)}>
      {options.map((o) => (
        <button key={o.id} role="tab" aria-selected={value === o.id} onClick={() => onChange(o.id)} className="relative z-10 rounded-full px-4 py-1.5 text-xs font-semibold text-white/60 transition-colors aria-selected:text-white focus-ring">
          {value === o.id && <motion.span layoutId={`seg-${options.map((x) => x.id).join('')}`} className="absolute inset-0 -z-10 rounded-full bg-white/10" transition={{ type: 'spring', stiffness: 400, damping: 35 }} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="glass flex flex-col items-center gap-3 rounded-3xl px-6 py-14 text-center">
      <div className="h-12 w-12 rounded-full bg-neon-gradient opacity-60 blur-[1px]" />
      <p className="font-display text-lg text-white">{title}</p>
      {children && <div className="max-w-sm text-sm text-white/55">{children}</div>}
    </div>
  );
}
