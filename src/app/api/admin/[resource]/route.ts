import { db, tx, uid, publicUser } from '@/lib/server/db';
import { ok, handle, body, HttpError } from '@/lib/server/http';
import { requireRole } from '@/lib/server/auth';
import { RESOURCES } from '@/lib/server/admin';
import { bookingView } from '@/lib/server/bookings';
export const dynamic = 'force-dynamic';

export const GET = handle(async (req: Request, { params }: { params: { resource: string } }) => {
  await requireRole('admin');
  const q = new URL(req.url).searchParams;
  if (params.resource === 'bookings') {
    const status = q.get('status');
    const list = db().bookings.filter((b) => (!status || b.status === status) && b.status !== 'expired').sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 300);
    const users = new Map(db().users.map((u) => [u.id, u]));
    return ok({ items: list.map((b) => ({ ...bookingView(b), user: { name: users.get(b.userId)?.name, email: users.get(b.userId)?.email } })) });
  }
  const r = RESOURCES[params.resource];
  if (!r) throw new HttpError(404, 'Unknown resource');
  let items: unknown[] = db()[r.coll] as unknown[];
  if (r.coll === 'users') items = db().users.map(publicUser);
  if (r.coll === 'shows') {
    const screen = q.get('screenId'), theatre = q.get('theatreId'), from = Date.now() - 6 * 3600_000;
    const screens = theatre ? new Set(db().screens.filter((s) => s.theatreId === theatre).map((s) => s.id)) : null;
    items = db().shows.filter((s) => (!screen || s.screenId === screen) && (!screens || screens.has(s.screenId)) && Date.parse(s.startsAt) > from).sort((a, b) => a.startsAt.localeCompare(b.startsAt)).slice(0, 500).map((s) => ({ ...s, soldOffline: s.soldOffline.length }));
  }
  if (r.coll === 'panoramas' && q.get('screenId')) items = db().panoramas.filter((p) => p.screenId === q.get('screenId'));
  return ok({ items });
});

export const POST = handle(async (req: Request, { params }: { params: { resource: string } }) => {
  await requireRole('admin');
  const r = RESOURCES[params.resource];
  if (!r?.create) throw new HttpError(404, 'Unknown resource');
  const v = await body(req, r.create);
  const item = tx((d) => {
    if (params.resource === 'shows') {
      const s = v as { movieId: string; screenId: string; startsAt: string };
      if (!d.movies.some((m) => m.id === s.movieId) || !d.screens.some((x) => x.id === s.screenId)) throw new HttpError(422, 'Unknown movie or screen');
      const mv = d.movies.find((m) => m.id === s.movieId)!;
      const start = Date.parse(s.startsAt), end = start + (mv.durationMin + 20) * 60_000;
      const clash = d.shows.find((x) => x.screenId === s.screenId && !x.cancelled && (() => { const xs = Date.parse(x.startsAt); const xm = d.movies.find((m) => m.id === x.movieId); const xe = xs + ((xm?.durationMin ?? 150) + 20) * 60_000; return start < xe && xs < end; })());
      if (clash) throw new HttpError(409, `Overlaps an existing show at ${new Date(clash.startsAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    }
    if (params.resource === 'screens' && !d.theatres.some((t) => t.id === (v as { theatreId: string }).theatreId)) throw new HttpError(422, 'Unknown theatre');
    if (params.resource === 'panoramas' && !d.screens.some((t) => t.id === (v as { screenId: string }).screenId)) throw new HttpError(422, 'Unknown screen');
    const item = { id: uid(r.prefix), ...(r.build ? r.build(v, d) : v) };
    (d[r.coll] as unknown[]).push(item);
    return item;
  });
  return ok({ item }, 201);
});
