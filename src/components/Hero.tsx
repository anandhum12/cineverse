'use client';
import { AnimatePresence, motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import type { Movie } from '@/lib/types';
import { Poster } from './Poster';
import { Button } from './ui/Button';
import { Stars } from './ui/misc';
import { Trailer } from './Trailer';
import { runtime } from '@/lib/format';

export function Hero({ movies }: { movies: Movie[] }) {
  const [i, setI] = useState(0);
  const [trailer, setTrailer] = useState(false);
  const [paused, setPaused] = useState(false);
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const bgY = useTransform(scrollYProgress, [0, 1], ['0%', reduce ? '0%' : '22%']);
  const bgScale = useTransform(scrollYProgress, [0, 1], [1.05, reduce ? 1.05 : 1.18]);
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const m = movies[i];

  useEffect(() => {
    if (paused || trailer || reduce || movies.length < 2) return;
    const t = setTimeout(() => setI((x) => (x + 1) % movies.length), 8000);
    return () => clearTimeout(t);
  }, [i, paused, trailer, reduce, movies.length]);

  if (!m) return null;
  return (
    <section ref={ref} className="relative h-[100svh] min-h-[640px] w-full overflow-hidden" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} aria-roledescription="carousel" aria-label="Featured films">
      <motion.div className="absolute inset-0" style={{ y: bgY, scale: bgScale }}>
        <AnimatePresence mode="sync">
          <motion.div key={m.id} className="absolute inset-0" initial={{ opacity: 0, scale: 1.08 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}>
            <Poster movie={m} variant="backdrop" />
          </motion.div>
        </AnimatePresence>
      </motion.div>
      {/* lighting */}
      <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/70 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#04050a] via-transparent to-ink-950/50" />
      <motion.div aria-hidden className="absolute -left-40 top-1/4 h-[60vh] w-[60vh] rounded-full blur-[120px]" style={{ background: m.palette[1], opacity: 0.25 }} animate={reduce ? undefined : { x: [0, 60, 0], y: [0, -30, 0] }} transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }} />

      <motion.div style={{ opacity: fade }} className="container-x relative flex h-full flex-col justify-end pb-24 sm:pb-28">
        <AnimatePresence mode="wait">
          <motion.div key={m.id} className="max-w-2xl" initial="hidden" animate="show" exit="exit" variants={{ show: { transition: { staggerChildren: 0.08 } }, exit: { opacity: 0, y: -10, transition: { duration: 0.3 } } }}>
            <motion.div variants={item} className="mb-5 flex flex-wrap items-center gap-2">
              <span className="chip border-neon-violet/40 bg-neon-violet/15 text-white">{m.status === 'now' ? 'Now showing' : 'Coming soon'}</span>
              {m.formats.slice(0, 3).map((f) => <span key={f} className="chip">{f}</span>)}
            </motion.div>
            <h1 className="font-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-7xl lg:text-8xl">
              {m.title.split(' ').map((w, wi) => (
                <span key={wi} className="mr-[0.22em] inline-block overflow-hidden pb-1 align-bottom">
                  <motion.span className="inline-block" variants={{ hidden: { y: '110%' }, show: { y: 0, transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] } } }}>{w}</motion.span>
                </span>
              ))}
            </h1>
            <motion.p variants={item} className="mt-4 text-lg font-medium text-white/80 sm:text-xl">{m.tagline}</motion.p>
            <motion.p variants={item} className="mt-3 line-clamp-3 max-w-xl text-sm leading-relaxed text-white/55 sm:text-base">{m.synopsis}</motion.p>
            <motion.div variants={item} className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/60">
              {m.rating > 0 && <Stars value={m.rating} size={14} />}
              <span>{m.genres.join(' · ')}</span><span className="h-1 w-1 rounded-full bg-white/30" /><span>{runtime(m.durationMin)}</span><span className="h-1 w-1 rounded-full bg-white/30" /><span>{m.certification}</span>
            </motion.div>
            <motion.div variants={item} className="mt-8 flex flex-wrap gap-3">
              <Button href={`/movies/${m.slug}#showtimes`} size="lg" magnetic>Book tickets</Button>
              <Button variant="glass" size="lg" onClick={() => setTrailer(true)} magnetic>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M7 4.5v15l13-7.5z" /></svg>Watch trailer
              </Button>
            </motion.div>
          </motion.div>
        </AnimatePresence>
        <div className="mt-12 flex items-center gap-2" role="tablist" aria-label="Choose featured film">
          {movies.map((mv, k) => (
            <button key={mv.id} role="tab" aria-selected={k === i} aria-label={mv.title} onClick={() => setI(k)} className="group relative h-1.5 overflow-hidden rounded-full bg-white/15 transition-all focus-ring" style={{ width: k === i ? 56 : 22 }}>
              {k === i && <motion.span key={`${i}-${paused}`} className="absolute inset-y-0 left-0 bg-white" initial={{ width: '0%' }} animate={{ width: paused || reduce ? '100%' : '100%' }} transition={{ duration: paused || reduce ? 0 : 8, ease: 'linear' }} />}
            </button>
          ))}
        </div>
      </motion.div>
      <Trailer movie={m} open={trailer} onClose={() => setTrailer(false)} />
    </section>
  );
}
const item = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } } };
