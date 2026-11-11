import { z } from 'zod';
import { getShow, getScreen } from '@/lib/server/db';
import { ok, handle, HttpError, holderId, body } from '@/lib/server/http';
import { locks, HOLD_MS } from '@/lib/server/locks';
import { blockedFor, notifyShow } from '@/lib/server/seats';
import { computeSeats } from '@/lib/geometry';
export const dynamic = 'force-dynamic';

const Schema = z.object({ seatIds: z.array(z.string().regex(/^[A-Z]{1,2}\d{1,3}$/)).max(10) });

/** Replace this visitor's held seats for the show with exactly `seatIds` (all-or-nothing). */
export const POST = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const show = getShow(params.id);
  if (!show || show.cancelled) throw new HttpError(404, 'Show not found');
  if (Date.parse(show.startsAt) < Date.now() - 15 * 60_000) throw new HttpError(409, 'This show has already started.');
  const { seatIds } = await body(req, Schema);
  const valid = new Set(computeSeats(getScreen(show.screenId)!.layout).map((s) => s.id));
  const bad = seatIds.filter((s) => !valid.has(s));
  if (bad.length) throw new HttpError(422, `Unknown seat ${bad.join(', ')}`);
  const hid = holderId();
  const unique = [...new Set(seatIds)];
  const r = await locks().hold(params.id, hid, unique, HOLD_MS, blockedFor(params.id, hid));
  if (!r.ok) throw new HttpError(409, r.conflicts.length === 1 ? `Seat ${r.conflicts[0]} was just taken by someone else.` : `Seats ${r.conflicts.join(', ')} were just taken.`, { conflicts: r.conflicts });
  notifyShow(params.id);
  return ok({ seatIds: unique, expiresAt: unique.length ? r.expiresAt : null });
});

export const DELETE = handle(async (_req: Request, { params }: { params: { id: string } }) => {
  await locks().release(params.id, holderId());
  notifyShow(params.id);
  return ok({ released: true });
});
