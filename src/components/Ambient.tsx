'use client';
import { useEffect, useRef } from 'react';

/** Slow drifting light + sparse particles on a canvas. Pauses when hidden / reduced motion. */
export function Ambient() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!; const ctx = c.getContext('2d'); if (!ctx) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    let w = 0, h = 0, raf = 0;
    const N = innerWidth < 700 ? 28 : 60;
    const ps = Array.from({ length: N }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.3 + 0.3, v: Math.random() * 0.00015 + 0.00004, a: Math.random() * 0.5 + 0.15 }));
    const resize = () => { w = c.width = innerWidth * dpr; h = c.height = innerHeight * dpr; };
    resize(); addEventListener('resize', resize);
    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      for (const p of ps) {
        p.y -= p.v * (reduce ? 0 : 16); if (p.y < -0.02) p.y = 1.02;
        ctx.beginPath(); ctx.arc(p.x * w + Math.sin(t / 4000 + p.x * 9) * 12 * dpr, p.y * h, p.r * dpr, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(190,180,255,${p.a * (0.6 + 0.4 * Math.sin(t / 1200 + p.x * 20))})`; ctx.fill();
      }
      if (!reduce && !document.hidden) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    const vis = () => { if (!document.hidden && !reduce) { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); } };
    document.addEventListener('visibilitychange', vis);
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', resize); document.removeEventListener('visibilitychange', vis); };
  }, []);
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -left-[20%] -top-[30%] h-[80vh] w-[80vh] rounded-full bg-neon-violet/[0.13] blur-[140px]" />
      <div className="absolute -right-[15%] top-[20%] h-[70vh] w-[70vh] rounded-full bg-neon-blue/[0.10] blur-[140px]" />
      <div className="absolute bottom-[-30%] left-[30%] h-[60vh] w-[60vh] rounded-full bg-neon-purple/[0.08] blur-[160px]" />
      <canvas ref={ref} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
