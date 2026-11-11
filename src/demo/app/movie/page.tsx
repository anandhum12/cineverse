'use client';
import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { MovieDetail } from '@/components/MovieDetail';
import { useDemoData, PageSkeleton } from '@/lib/demo/hooks';
import { useAppSession } from '@/lib/session';

function Inner() {
  const slug = useSearchParams().get('m') || '';
  const { user } = useAppSession();
  const d = useDemoData((x) => {
    const movie = x.movies.find((m) => m.slug === slug || m.id === slug);
    return movie ? { movie: { ...movie }, reviews: x.reviews.filter((r) => r.movieId === movie.id), fav: !!x.users.find((u) => u.id === user?.id)?.favourites.includes(movie.id) } : { movie: null, reviews: [], fav: false };
  });
  useEffect(() => { if (d?.movie) document.title = `${d.movie.title} · CineVerse`; }, [d?.movie]);
  // scroll to #showtimes once the client-rendered content exists
  useEffect(() => { if (d?.movie && location.hash) setTimeout(() => document.querySelector(location.hash)?.scrollIntoView({ behavior: 'smooth' }), 300); }, [d?.movie]);
  if (!d) return <PageSkeleton />;
  if (!d.movie) return <div className="container-x pt-40 text-center"><p className="font-display text-2xl">Movie not found</p><Link href="/movies/" className="mt-3 inline-block underline">All movies</Link></div>;
  return <MovieDetail key={`${d.movie.id}${d.fav}`} movie={d.movie} reviews={d.reviews} initialFav={d.fav} />;
}
export default function DemoMovie() { return <Suspense fallback={<PageSkeleton />}><Inner /></Suspense>; }
