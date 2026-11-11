import { db } from '@/lib/server/db';
import { ok, handle } from '@/lib/server/http';
import { requireRole } from '@/lib/server/auth';
import { istDay } from '@/lib/format';
export const dynamic = 'force-dynamic';
export const GET = handle(async () => {
  await requireRole('admin');
  const d = db();
  const confirmed = d.bookings.filter((b) => b.status === 'confirmed' || (b.status === 'cancelled' && b.confirmedAt));
  const gross = confirmed.reduce((a, b) => a + b.pricing.total, 0);
  const refunds = d.bookings.reduce((a, b) => a + (b.refund?.amount ?? 0), 0);
  const days = Array.from({ length: 14 }, (_, i) => istDay(new Date(Date.now() - (13 - i) * 864e5)));
  const byDay = days.map((day) => ({ day, revenue: confirmed.filter((b) => istDay(b.confirmedAt!) === day).reduce((a, b) => a + b.pricing.total, 0), tickets: confirmed.filter((b) => istDay(b.confirmedAt!) === day).reduce((a, b) => a + b.seatIds.length, 0) }));
  const byMovie = new Map<string, { title: string; revenue: number; tickets: number }>();
  for (const b of confirmed) {
    const s = d.shows.find((x) => x.id === b.showId); const m = s && d.movies.find((x) => x.id === s.movieId); if (!m) continue;
    const e = byMovie.get(m.id) ?? { title: m.title, revenue: 0, tickets: 0 }; e.revenue += b.pricing.total; e.tickets += b.seatIds.length; byMovie.set(m.id, e);
  }
  return ok({
    gross, refunds, net: gross - refunds,
    bookings: d.bookings.filter((b) => b.status === 'confirmed').length,
    tickets: confirmed.reduce((a, b) => a + b.seatIds.length, 0),
    users: d.users.length, movies: d.movies.length, theatres: d.theatres.length, screens: d.screens.length,
    upcomingShows: d.shows.filter((s) => Date.parse(s.startsAt) > Date.now() && !s.cancelled).length,
    failedPayments: d.payments.filter((p) => p.status === 'failed').length,
    byDay, topMovies: [...byMovie.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 6),
  });
});
