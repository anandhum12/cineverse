'use client';
import { useRef } from 'react';
import type { Movie } from '@/lib/types';
import { MovieCard } from './MovieCard';

export function MovieRail({ title, eyebrow, movies, id }: { title: string; eyebrow?: string; movies: Movie[]; id?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (d: number) => ref.current?.scrollBy({ left: d * ref.current.clientWidth * 0.8, behavior: 'smooth' });
  if (!movies.length) return null;
  return (
    <section id={id} className="relative py-8" aria-labelledby={`${id ?? title}-h`}>
      <div className="container-x mb-5 flex items-end justify-between gap-4">
        <div>{eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}<h2 id={`${id ?? title}-h`} className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2></div>
        <div className="hidden gap-2 sm:flex">
          <button onClick={() => scroll(-1)} aria-label={`Scroll ${title} left`} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 text-white/70 transition hover:border-white/30 hover:text-white focus-ring">←</button>
          <button onClick={() => scroll(1)} aria-label={`Scroll ${title} right`} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 text-white/70 transition hover:border-white/30 hover:text-white focus-ring">→</button>
        </div>
      </div>
      <div ref={ref} className="no-scrollbar flex snap-x gap-4 overflow-x-auto scroll-smooth px-4 pb-6 pt-2 sm:gap-6 sm:px-6 lg:px-10 [&>*]:snap-start">
        {movies.map((m, i) => <MovieCard key={m.id} movie={m} index={i} />)}
        <div className="w-2 shrink-0" />
      </div>
    </section>
  );
}
