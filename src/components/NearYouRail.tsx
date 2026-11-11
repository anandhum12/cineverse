'use client';
import { useEffect, useState } from 'react';
import type { Movie } from '@/lib/types';
import { useLocation } from '@/lib/store';
import { MovieRail } from './MovieRail';
import { Skeleton } from './ui/misc';

/** Films with upcoming shows in the user's city. */
export function NearYouRail({ movies }: { movies: Movie[] }) {
  const loc = useLocation((s) => s.location);
  const [ids, setIds] = useState<string[] | null>(null);
  useEffect(() => {
    if (!loc) return;
    setIds(null);
    fetch(`/api/movies/near?city=${loc.cityId}`).then((r) => r.json()).then((d) => setIds(d.movieIds ?? [])).catch(() => setIds([]));
  }, [loc]);
  if (!loc) return null;
  if (!ids) return <div className="container-x py-8"><Skeleton className="mb-5 h-8 w-64" /><div className="flex gap-6">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="aspect-[2/3] w-[200px] shrink-0" />)}</div></div>;
  return <MovieRail id="near" eyebrow={`Playing in ${loc.label}`} title="Movies near you" movies={ids.map((id) => movies.find((m) => m.id === id)!).filter(Boolean)} />;
}
