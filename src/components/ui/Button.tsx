'use client';
import { motion, useMotionValue, useSpring, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { forwardRef, useRef, type ReactNode, type MouseEvent } from 'react';
import { cx } from '@/lib/format';

type Variant = 'primary' | 'ghost' | 'glass' | 'outline' | 'danger';
interface Props {
  children: ReactNode; variant?: Variant; size?: 'sm' | 'md' | 'lg'; href?: string; magnetic?: boolean;
  className?: string; disabled?: boolean; type?: 'button' | 'submit'; onClick?: (e: MouseEvent) => void; loading?: boolean; 'aria-label'?: string;
}

const styles: Record<Variant, string> = {
  primary: 'bg-neon-gradient text-white shadow-glow hover:shadow-[0_0_60px_-6px_rgba(139,92,246,.75)]',
  ghost: 'text-white/80 hover:text-white hover:bg-white/[0.06]',
  glass: 'glass text-white hover:bg-white/[0.08]',
  outline: 'border border-white/15 text-white hover:border-white/35 hover:bg-white/[0.04]',
  danger: 'bg-rose-500/15 text-rose-200 border border-rose-400/30 hover:bg-rose-500/25',
};
const sizes = { sm: 'h-9 px-4 text-xs', md: 'h-11 px-5 text-sm', lg: 'h-14 px-8 text-base' };

/** Magnetic button: gently follows the cursor (disabled for reduced motion / touch). */
export const Button = forwardRef<HTMLButtonElement, Props>(function Button({ children, variant = 'primary', size = 'md', href, magnetic, className, disabled, type = 'button', onClick, loading, ...aria }, _ref) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0), y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 15 }), sy = useSpring(y, { stiffness: 220, damping: 15 });
  const el = useRef<HTMLDivElement>(null);
  const onMove = (e: React.PointerEvent) => {
    if (!magnetic || reduce || e.pointerType !== 'mouse' || !el.current) return;
    const r = el.current.getBoundingClientRect();
    x.set((e.clientX - r.left - r.width / 2) * 0.25); y.set((e.clientY - r.top - r.height / 2) * 0.35);
  };
  const reset = () => { x.set(0); y.set(0); };
  const cls = cx('relative inline-flex select-none items-center justify-center gap-2 rounded-full font-semibold tracking-tight transition-[background,box-shadow,color,border-color] duration-300 focus-ring disabled:pointer-events-none disabled:opacity-40', styles[variant], sizes[size], className);
  const inner = <>{loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}{children}</>;
  return (
    <motion.div ref={el} style={{ x: sx, y: sy }} onPointerMove={onMove} onPointerLeave={reset} className={cx('inline-flex', className?.includes('w-full') && 'w-full')} whileTap={reduce ? undefined : { scale: 0.96 }}>
      {href ? <Link href={href} className={cls} {...aria}>{inner}</Link> : <button type={type} className={cls} disabled={disabled || loading} onClick={onClick} {...aria}>{inner}</button>}
    </motion.div>
  );
});
