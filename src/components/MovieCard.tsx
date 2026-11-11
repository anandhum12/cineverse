'use client';
import Link from 'next/link';
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion, useMotionTemplate } from 'framer-motion';
import type { Movie } from '@/lib/types';
import { Poster } from './Poster';
import { Stars } from './ui/misc';
import { fmtDate, runtime } from '@/lib/format';
import { routes } from '@/lib/routes';

export function MovieCard({ movie, index = 0 }: { movie: Movie; index?: number }) {
  const reduce = useReducedMotion();
  const mx = useMotionValue(0.5), my = useMotionValue(0.5);
  const rx = useSpring(useTransform(my, [0, 1], [6, -6]), { stiffness: 200, damping: 20 });
  const ry = useSpring(useTransform(mx, [0, 1], [-8, 8]), { stiffness: 200, damping: 20 });
  const glareX = useTransform(mx, (v) => `${v * 100}%`);
  const glareY = useTransform(my, (v) => `${v * 100}%`);
  const glare = useMotionTemplate`radial-gradient(circle at ${glareX} ${glareY}, rgba(255,255,255,.22), transparent 45%)`;
  const soon = movie.status === 'soon';

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ delay: Math.min(index, 8) * 0.05, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="group relative w-[168px] shrink-0 sm:w-[200px] lg:w-[220px]" style={{ perspective: 900 }}>
      <motion.div
        onPointerMove={(e) => { if (reduce || e.pointerType !== 'mouse') return; const r = e.currentTarget.getBoundingClientRect(); mx.set((e.clientX - r.left) / r.width); my.set((e.clientY - r.top) / r.height); }}
        onPointerLeave={() => { mx.set(0.5); my.set(0.5); }}
        style={reduce ? undefined : { rotateX: rx, rotateY: ry, transformStyle: 'preserve-3d' }}
        whileHover={reduce ? undefined : { scale: 1.05 }} transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-ink-800 shadow-[0_30px_60px_-30px_rgba(0,0,0,.9)] ring-1 ring-white/10">
        <Link href={routes.movie(movie.slug)} className="absolute inset-0 focus-ring rounded-2xl" aria-label={`${movie.title} details`}>
          <Poster movie={movie} />
        </Link>
        {/* cinematic light: glare that follows the cursor + violet rim glow */}
        <motion.div aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{ background: glare }} />
        <div aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 shadow-[inset_0_0_0_1px_rgba(167,139,250,.6),inset_0_-80px_80px_-40px_rgba(139,92,246,.45)] transition-opacity duration-500 group-hover:opacity-100" />
        <div className="absolute left-2.5 top-2.5 flex gap-1.5">
          {soon ? <span className="chip border-neon-cyan/30 bg-black/50 text-[10px] text-neon-cyan backdrop-blur">{fmtDate(movie.releaseDate, { day: 'numeric', month: 'short' })}</span>
            : <span className="chip bg-black/50 text-[10px] backdrop-blur"><Stars value={movie.rating} size={10} /></span>}
        </div>
        {/* details reveal */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-3 bg-gradient-to-t from-black via-black/85 to-transparent p-3 pt-12 opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
          <p className="text-[11px] text-white/70">{movie.genres.slice(0, 2).join(' · ')} · {runtime(movie.durationMin)}</p>
          <p className="mt-0.5 text-[11px] text-white/50">{movie.languages.slice(0, 3).join(', ')}{movie.languages.length > 3 ? ' +' : ''}</p>
          <Link href={routes.movie(movie.slug, soon ? '' : '#showtimes')} className="pointer-events-auto mt-2.5 flex h-8 items-center justify-center rounded-full bg-white text-[11px] font-bold text-ink-950 transition hover:bg-neon-violet hover:text-white focus-ring">
            {soon ? 'View details' : 'Quick book'}
          </Link>
        </div>
      </motion.div>
      <div className="mt-3 px-0.5">
        <h3 className="truncate font-display text-[15px] font-semibold text-white">{movie.title}</h3>
        <p className="mt-0.5 truncate text-xs text-white/45">{movie.genres[0]} · {movie.certification} · {soon ? `Releases ${fmtDate(movie.releaseDate)}` : movie.languages[0]}</p>
      </div>
    </motion.article>
  );
}
