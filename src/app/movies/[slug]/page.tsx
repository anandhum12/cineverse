import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { db, getMovie } from '@/lib/server/db';
import { sessionUser } from '@/lib/server/auth';
import { MovieDetail } from '@/components/MovieDetail';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const m = getMovie(params.slug);
  return m ? { title: m.title, description: `${m.tagline} ${m.synopsis}`.slice(0, 160) } : { title: 'Movie not found' };
}

export default async function MoviePage({ params }: { params: { slug: string } }) {
  const movie = getMovie(params.slug);
  if (!movie) notFound();
  const user = await sessionUser();
  return <MovieDetail movie={movie} reviews={db().reviews.filter((r) => r.movieId === movie.id)} initialFav={!!user?.favourites.includes(movie.id)} />;
}
