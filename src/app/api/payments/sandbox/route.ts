import { z } from 'zod';
import { db } from '@/lib/server/db';
import { ok, handle, body, HttpError } from '@/lib/server/http';
import { requireUser } from '@/lib/server/auth';
import { sandboxCharge } from '@/lib/server/payments';

/**
 * Sandbox gateway "checkout": simulates the customer paying at the gateway.
 * Returns the same payload Razorpay Checkout returns; the client must still call /api/payments/verify.
 */
export const POST = handle(async (req: Request) => {
  const u = await requireUser();
  const { bookingId, outcome } = await body(req, z.object({ bookingId: z.string(), outcome: z.enum(['success', 'failure']), method: z.string().max(30).optional() }));
  const b = db().bookings.find((x) => x.id === bookingId && x.userId === u.id);
  if (!b) throw new HttpError(404, 'Booking not found');
  // a declined attempt can be retried on the same order, as with Razorpay
  const p = db().payments.find((x) => x.bookingId === b.id && (x.status === 'created' || x.status === 'failed'));
  if (!p) throw new HttpError(409, 'No open payment for this booking');
  await new Promise((r) => setTimeout(r, 900)); // feel of a real gateway round-trip
  try {
    const r = sandboxCharge(p.orderId, outcome);
    if (!r.ok) throw new HttpError(402, r.error);
    return ok({ razorpay_order_id: p.orderId, razorpay_payment_id: r.paymentId, razorpay_signature: r.signature });
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(403, (e as Error).message);
  }
});
