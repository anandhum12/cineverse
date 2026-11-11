import { db, tx } from '@/lib/server/db';
import { verifyWebhook, sign } from '@/lib/server/payments';
import { confirmPayment } from '@/lib/server/bookings';

/**
 * Razorpay webhook (payment.captured / payment.failed). Covers the case where the user closes the
 * tab after paying: the booking is still confirmed server-side. Idempotent by event id.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyWebhook(raw, req.headers.get('x-razorpay-signature'))) return new Response('invalid signature', { status: 401 });
  const evt = JSON.parse(raw) as { event: string; payload?: { payment?: { entity?: { id: string; order_id: string; method?: string; error_description?: string } } } };
  const eventId = req.headers.get('x-razorpay-event-id') || '';
  if (eventId && db().processedEvents.includes(`wh:${eventId}`)) return new Response('ok');
  const pe = evt.payload?.payment?.entity;
  const payment = pe && db().payments.find((p) => p.orderId === pe.order_id);
  if (pe && payment) {
    if (evt.event === 'payment.captured') {
      try { await confirmPayment({ bookingId: payment.bookingId, orderId: pe.order_id, paymentId: pe.id, signature: sign(pe.order_id, pe.id), method: pe.method }, null); } catch (e) { console.warn('[webhook]', (e as Error).message); }
    } else if (evt.event === 'payment.failed') {
      tx((d) => { const p = d.payments.find((x) => x.id === payment.id); if (p && p.status === 'created') { p.status = 'failed'; p.failureReason = pe.error_description; p.updatedAt = new Date().toISOString(); } });
    }
  }
  if (eventId) tx((d) => { d.processedEvents.push(`wh:${eventId}`); if (d.processedEvents.length > 5000) d.processedEvents.splice(0, 1000); });
  return new Response('ok');
}
