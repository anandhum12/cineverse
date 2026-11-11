import { db, showContext } from '@/lib/server/db';
import { ok, handle, HttpError, holderId } from '@/lib/server/http';
import { seatStates } from '@/lib/server/seats';
import { locks } from '@/lib/server/locks';
export const dynamic = 'force-dynamic';

export const GET = handle(async (_req: Request, { params }: { params: { id: string } }) => {
  const ctx = showContext(params.id);
  if (!ctx) throw new HttpError(404, 'Show not found');
  const hid = holderId();
  const states = await seatStates(params.id, hid);
  const mine = [...(await locks().all(params.id))].filter(([, v]) => v.holderId === hid);
  return ok({
    show: ctx.show && { ...ctx.show, soldOffline: undefined },
    movie: ctx.movie,
    theatre: ctx.theatre,
    screen: ctx.screen,
    states,
    hold: mine.length ? { seatIds: mine.map(([k]) => k), expiresAt: Math.min(...mine.map(([, v]) => v.expiresAt)) } : null,
    panoramas: db().panoramas.filter((p) => p.screenId === ctx.screen.id),
  });
});
