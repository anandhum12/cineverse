'use client';
import { useState } from 'react';
import { useAppSession } from '@/lib/session';
import { routes } from '@/lib/routes';
import { useRouter } from 'next/navigation';
import type { Movie } from '@/lib/types';
import { Button } from './ui/Button';
import { Trailer } from './Trailer';
import { api } from '@/lib/client';
import { toast } from '@/lib/store';

export function MovieActions({ movie, initialFav }: { movie: Movie; initialFav: boolean }) {
  const [open, setOpen] = useState(false);
  const [fav, setFav] = useState(initialFav);
  const { status } = useAppSession();
  const router = useRouter();
  const toggle = async () => {
    if (status !== 'authenticated') return router.push(routes.login(routes.movie(movie.slug)));
    setFav((f) => !f);
    try { const r = await api<{ favourites: string[] }>('/api/favourites', { method: 'POST', json: { movieId: movie.id } }); setFav(r.favourites.includes(movie.id)); }
    catch (e) { setFav((f) => !f); toast('error', (e as Error).message); }
  };
  return (
    <div className="mt-8 flex flex-wrap gap-3">
      {movie.status === 'now' && <Button href="#showtimes" size="lg" magnetic>Book tickets</Button>}
      <Button variant="glass" size="lg" onClick={() => setOpen(true)} magnetic><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M7 4.5v15l13-7.5z" /></svg>Trailer</Button>
      <Button variant="outline" size="lg" onClick={toggle} aria-label={fav ? 'Remove from favourites' : 'Add to favourites'}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill={fav ? '#ff4fd8' : 'none'} stroke={fav ? '#ff4fd8' : 'currentColor'} strokeWidth="2" aria-hidden><path d="M12 21s-7.5-4.6-9.5-9.3C1.1 8.2 3.4 4.5 7 4.5c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.6 0 5.9 3.7 4.5 7.2C19.5 16.4 12 21 12 21z" /></svg>
        {fav ? 'Saved' : 'Favourite'}
      </Button>
      <Trailer movie={movie} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
