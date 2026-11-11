import { z } from 'zod';
import { getMovie, tx } from '@/lib/server/db';
import { ok, handle, body, HttpError } from '@/lib/server/http';
import { requireUser } from '@/lib/server/auth';
export const POST = handle(async (req: Request) => {
  const u = await requireUser();
  const { movieId } = await body(req, z.object({ movieId: z.string() }));
  if (!getMovie(movieId)) throw new HttpError(404, 'Movie not found');
  const favourites = tx((d) => {
    const me = d.users.find((x) => x.id === u.id)!;
    me.favourites = me.favourites.includes(movieId) ? me.favourites.filter((x) => x !== movieId) : [...me.favourites, movieId];
    return me.favourites;
  });
  return ok({ favourites });
});
