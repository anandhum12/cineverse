import { z } from 'zod';
import { db } from '@/lib/server/db';
import { ok, handle, body, holderId } from '@/lib/server/http';
import { requireUser } from '@/lib/server/auth';
import { createPendingBooking, bookingView } from '@/lib/server/bookings';
export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  const u = await requireUser();
  const list = db().bookings.filter((b) => b.userId === u.id && b.status !== 'expired').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return ok({ bookings: list.map(bookingView) });
});

/** Create a pending booking from the visitor's currently held seats. */
export const POST = handle(async (req: Request) => {
  const u = await requireUser();
  const { showId } = await body(req, z.object({ showId: z.string().min(1) }));
  const r = await createPendingBooking(u, holderId(), showId);
  return ok({ bookingId: r.booking.id }, 201);
});
