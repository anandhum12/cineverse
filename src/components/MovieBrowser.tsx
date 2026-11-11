'use client';
import { useMemo, useState } from 'react';
import type { Movie } from '@/lib/types';
import { MovieCard } from './MovieCard';
import { Empty, Segmented } from './ui/misc';
import { cx } from '@/lib/format';

export function MovieBrowser({ movies }: { movies: Movie[] }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | 'now' | 'soon'>('all');
  const [genre, setGenre] = useState('');
  const [lang, setLang] = useState('');
  const genres = useMemo(() => [...new Set(movies.flatMap((m) => m.genres))].sort(), [movies]);
  const langs = useMemo(() => [...new Set(movies.flatMap((m) => m.languages))].sort(), [movies]);
  const list = movies.filter((m) => (status === 'all' || m.status === status) && (!genre || m.genres.includes(genre)) && (!lang || m.languages.includes(lang)) &&
    (!q || `${m.title} ${m.director} ${m.cast.map((c) => c.name).join(' ')} ${m.genres.join(' ')}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="mt-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles, cast, directors…" className="input md:max-w-sm" aria-label="Search movies" />
        <Segmented value={status} onChange={setStatus} options={[{ id: 'all', label: 'All' }, { id: 'now', label: 'Now showing' }, { id: 'soon', label: 'Coming soon' }]} />
        <select aria-label="Language" value={lang} onChange={(e) => setLang(e.target.value)} className="input !w-auto !rounded-full !py-2"><option value="">All languages</option>{langs.map((l) => <option key={l}>{l}</option>)}</select>
      </div>
      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => setGenre('')} className={cx('chip shrink-0', !genre && 'border-neon-violet bg-neon-violet/20 text-white')}>All genres</button>
        {genres.map((g) => <button key={g} onClick={() => setGenre(g === genre ? '' : g)} className={cx('chip shrink-0', genre === g && 'border-neon-violet bg-neon-violet/20 text-white')}>{g}</button>)}
      </div>
      <div className="mt-8 grid grid-cols-2 justify-items-center gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 [&>article]:w-full">
        {list.map((m, i) => <MovieCard key={m.id} movie={m} index={i} />)}
      </div>
      {!list.length && <Empty title="Nothing matches">Try a different search or clear the filters.</Empty>}
    </div>
  );
}
