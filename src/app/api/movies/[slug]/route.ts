import { db, getMovie } from '@/lib/server/db';
import { ok, handle, HttpError } from '@/lib/server/http';
export const dynamic = 'force-dynamic';
export const GET = handle(async (_req: Request, { params }: { params: { slug: string } }) => {
  const movie = getMovie(params.slug);
  if (!movie) throw new HttpError(404, 'Movie not found');
  return ok({ movie, reviews: db().reviews.filter((r) => r.movieId === movie.id) });
});
