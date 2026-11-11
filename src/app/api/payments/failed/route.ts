import { z } from 'zod';
import { ok, handle, body } from '@/lib/server/http';
import { requireUser } from '@/lib/server/auth';
import { markPaymentFailed } from '@/lib/server/bookings';
export const POST = handle(async (req: Request) => {
  const u = await requireUser();
  const { bookingId, reason } = await body(req, z.object({ bookingId: z.string(), reason: z.string().max(300).default('Payment failed') }));
  markPaymentFailed(bookingId, u.id, reason ?? 'Payment failed');
  return ok({ ok: true });
});
