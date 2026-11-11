import { db } from '@/lib/server/db';
import { ok, handle } from '@/lib/server/http';
export const dynamic = 'force-dynamic';
export const GET = handle(async (req: Request) => {
  const u = new URL(req.url);
  const status = u.searchParams.get('status');
  const q = u.searchParams.get('q')?.toLowerCase().trim();
  const genre = u.searchParams.get('genre');
  const lang = u.searchParams.get('language');
  const movies = db().movies.filter((m) => (!status || m.status === status) && (!genre || m.genres.includes(genre)) && (!lang || m.languages.includes(lang)) &&
    (!q || `${m.title} ${m.genres.join(' ')} ${m.director} ${m.cast.map((c) => c.name).join(' ')}`.toLowerCase().includes(q)));
  return ok({ movies });
});
