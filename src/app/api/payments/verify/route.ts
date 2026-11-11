import { z } from 'zod';
import { ok, handle, body } from '@/lib/server/http';
import { requireUser } from '@/lib/server/auth';
import { confirmPayment } from '@/lib/server/bookings';

const Schema = z.object({
  bookingId: z.string().min(1),
  razorpay_order_id: z.string().min(1).max(64),
  razorpay_payment_id: z.string().min(1).max(64),
  razorpay_signature: z.string().min(1).max(128),
  method: z.string().max(30).optional(),
});

/** The ONLY path that confirms a booking from the client flow: HMAC + gateway verification server-side. */
export const POST = handle(async (req: Request) => {
  const u = await requireUser();
  const b = await body(req, Schema);
  const booking = await confirmPayment({ bookingId: b.bookingId, orderId: b.razorpay_order_id, paymentId: b.razorpay_payment_id, signature: b.razorpay_signature, method: b.method }, u.id);
  return ok({ bookingId: booking.id, status: booking.status });
});
