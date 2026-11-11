import { db, showContext } from '@/lib/server/db';
import { verifyTicketToken } from '@/lib/server/payments';
import { fmtDate, fmtTime } from '@/lib/format';
export const dynamic = 'force-dynamic';

/** Gate scanners hit this URL from the QR code. Returns validity without exposing personal data. */
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const id = p.get('b') || '', t = p.get('t') || '';
  const b = db().bookings.find((x) => x.id === id);
  if (!b || !verifyTicketToken(id, t)) return Response.json({ valid: false, reason: 'Unrecognised ticket' }, { status: 404 });
  const ctx = showContext(b.showId)!;
  const valid = b.status === 'confirmed';
  return Response.json({ valid, status: b.status, code: b.code, movie: ctx.movie.title, theatre: ctx.theatre.name, screen: ctx.screen.name, date: fmtDate(ctx.show.startsAt), time: fmtTime(ctx.show.startsAt), seats: b.seatIds });
}
