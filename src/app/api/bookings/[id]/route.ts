import { db } from '@/lib/server/db';
import { ok, handle, HttpError } from '@/lib/server/http';
import { requireUser } from '@/lib/server/auth';
import { bookingView, cancellationQuote } from '@/lib/server/bookings';
import { provider, sandboxAllowed } from '@/lib/server/payments';
export const dynamic = 'force-dynamic';

export const GET = handle(async (_req: Request, { params }: { params: { id: string } }) => {
  const u = await requireUser();
  const b = db().bookings.find((x) => x.id === params.id);
  if (!b || (b.userId !== u.id && u.role !== 'admin')) throw new HttpError(404, 'Booking not found');
  return ok({ ...bookingView(b), cancellation: cancellationQuote(b), gateway: { provider, keyId: provider === 'razorpay' ? process.env.RAZORPAY_KEY_ID : null, sandbox: sandboxAllowed() }, user: { name: u.name, email: u.email } });
});
