'use client';
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion';
import { Button } from './ui/Button';

/** Homepage section introducing the 180° seat preview with a small interactive CSS-3D auditorium. */
export function SignatureTeaser() {
  const reduce = useReducedMotion();
  const px = useMotionValue(0.5);
  const yaw = useSpring(useTransform(px, [0, 1], [-28, 28]), { stiffness: 80, damping: 18 });
  const rows = 7, cols = 14;
  return (
    <section className="container-x py-16" aria-labelledby="sig-h">
      <div className="glass relative overflow-hidden rounded-[2rem] p-6 sm:p-10 lg:p-14">
        <div aria-hidden className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-neon-violet/25 blur-[100px]" />
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="eyebrow mb-3 text-neon-cyan/80">Only on CineVerse</p>
            <h2 id="sig-h" className="font-display text-3xl font-bold leading-tight sm:text-5xl">Sit in your seat <span className="text-gradient">before you book it.</span></h2>
            <p className="mt-4 max-w-lg text-white/60">Tap any seat and step into a 180° view of the auditorium from that exact position. You see the real screen size, viewing angle and distance, plus the seats around you. Drag to look around, or use your phone&apos;s gyroscope.</p>
            <ul className="mt-6 grid max-w-md grid-cols-2 gap-3 text-sm text-white/70">
              {['True viewing angle', 'Screen distance in metres', 'Seat quality score', 'VR & gyroscope mode'].map((t) => (
                <li key={t} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-neon-violet shadow-glow" />{t}</li>
              ))}
            </ul>
            <div className="mt-8"><Button href="/movies" magnetic>Try it on any show</Button></div>
          </div>
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl bg-black/60 ring-1 ring-white/10" style={{ perspective: 700 }}
            onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); px.set((e.clientX - r.left) / r.width); }} onPointerLeave={() => px.set(0.5)}>
            <motion.div className="absolute inset-0" style={{ rotateY: reduce ? 0 : yaw, transformStyle: 'preserve-3d' }}>
              {/* screen */}
              <div className="absolute left-[12%] right-[12%] top-[10%] h-[34%] rounded-md bg-gradient-to-br from-neon-blue via-neon-violet to-neon-purple shadow-[0_0_120px_20px_rgba(139,92,246,.45)]" style={{ transform: 'translateZ(-160px)' }}>
                <div className="absolute inset-0 animate-shimmer rounded-md bg-[linear-gradient(110deg,transparent_30%,rgba(255,255,255,.25)_50%,transparent_70%)] bg-[length:200%_100%]" />
              </div>
              {/* seats in perspective */}
              <div className="absolute inset-x-[2%] bottom-[-6%] h-[62%]" style={{ transform: 'rotateX(58deg)', transformOrigin: 'bottom' }}>
                {Array.from({ length: rows }, (_, r) => (
                  <div key={r} className="flex justify-center gap-[1.2%]" style={{ marginTop: r ? '2.4%' : 0 }}>
                    {Array.from({ length: cols }, (_, c) => {
                      const mine = r === 4 && c === 6;
                      const taken = (r * 7 + c * 3) % 5 === 0;
                      return <div key={c} className={`h-5 w-[5.2%] rounded-t-md ${mine ? 'bg-neon-violet shadow-glow' : taken ? 'bg-white/10' : 'bg-white/25'} ${c === 3 || c === 10 ? 'mr-[3%]' : ''}`} />;
                    })}
                  </div>
                ))}
              </div>
            </motion.div>
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-2xl bg-black/50 px-4 py-2.5 text-xs backdrop-blur">
              <span><b className="text-white">E7</b> <span className="text-white/50">· Prime · 11.4 m · 41° FOV</span></span>
              <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-emerald-300">Excellent</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
