import { tx, publicUser } from '@/lib/server/db';
import { ok, handle, body, HttpError } from '@/lib/server/http';
import { requireRole } from '@/lib/server/auth';
import { RESOURCES } from '@/lib/server/admin';
import { notifyShow } from '@/lib/server/seats';
import type { User } from '@/lib/types';
export const dynamic = 'force-dynamic';

export const PUT = handle(async (req: Request, { params }: { params: { resource: string; id: string } }) => {
  const me = await requireRole('admin');
  const r = RESOURCES[params.resource];
  if (!r) throw new HttpError(404, 'Unknown resource');
  const v = await body(req, r.update) as Record<string, unknown>;
  if (params.resource === 'users' && params.id === me.id && v.role !== 'admin') throw new HttpError(409, 'You cannot remove your own admin access.');
  const item = tx((d) => {
    const list = d[r.coll] as { id: string }[];
    const i = list.findIndex((x) => x.id === params.id);
    if (i < 0) throw new HttpError(404, 'Not found');
    if (params.resource === 'shows' && v.startsAt) v.startsAt = new Date(v.startsAt as string).toISOString();
    if (params.resource === 'screens' && v.layout) {
      // seats with confirmed future bookings must still exist in the new layout
      const ids = new Set((v.layout as { rows: { label: string; cells: { t: string; n?: number }[] }[] }).rows.flatMap((row) => row.cells.filter((c) => c.t === 's').map((c) => `${row.label}${c.n}`)));
      const shows = new Set(d.shows.filter((s) => s.screenId === params.id && Date.parse(s.startsAt) > Date.now()).map((s) => s.id));
      const orphan = d.bookings.filter((b) => shows.has(b.showId) && b.status === 'confirmed').flatMap((b) => b.seatIds).filter((s) => !ids.has(s));
      if (orphan.length) throw new HttpError(409, `Layout removes booked seats: ${[...new Set(orphan)].slice(0, 8).join(', ')}`);
    }
    list[i] = { ...list[i], ...v };
    return list[i];
  });
  if (params.resource === 'shows') notifyShow(params.id);
  return ok({ item: params.resource === 'users' ? publicUser(item as User) : item });
});

export const DELETE = handle(async (_req: Request, { params }: { params: { resource: string; id: string } }) => {
  await requireRole('admin');
  const r = RESOURCES[params.resource];
  if (!r || r.coll === 'users') throw new HttpError(404, 'Unknown resource');
  tx((d) => {
    const reason = r.guardDelete?.(params.id, d);
    if (reason) throw new HttpError(409, reason);
    const list = d[r.coll] as { id: string }[];
    const i = list.findIndex((x) => x.id === params.id);
    if (i < 0) throw new HttpError(404, 'Not found');
    list.splice(i, 1);
  });
  return ok({ deleted: true });
});
