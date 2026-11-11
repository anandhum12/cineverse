import { showContext } from '@/lib/server/db';
import { ok, handle, HttpError, holderId } from '@/lib/server/http';
import { seatStates } from '@/lib/server/seats';
import { recommendSeats, PREFERENCES, type Preference } from '@/lib/recommend';
export const dynamic = 'force-dynamic';

export const GET = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const ctx = showContext(params.id);
  if (!ctx) throw new HttpError(404, 'Show not found');
  const p = new URL(req.url).searchParams;
  const pref = (p.get('pref') || 'best') as Preference;
  if (!PREFERENCES.some((x) => x.id === pref)) throw new HttpError(422, 'Unknown preference');
  const party = Math.max(1, Math.min(10, Number(p.get('party')) || 2));
  const states = await seatStates(params.id, holderId());
  return ok({ recommendations: recommendSeats(ctx.screen.layout, ctx.show, states, pref, party) });
});
