import { randomBytes } from 'crypto';
import type { Booking, User } from '../types';
import { priceSeats } from '../pricing';
import { db, getShow, getScreen, getTheatre, occupiedSeats, showContext, tx, uid } from './db';
import { HttpError } from './errors';
import { locks, PAYMENT_HOLD_MS } from './locks';
import { blockedFor, notifyShow } from './seats';
import * as pay from './payments';

const MAX_SEATS = 10;
const code = () => {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const b = randomBytes(8);
  const s = [...b].map((x) => a[x % a.length]).join('');
  return `CV-${s.slice(0, 4)}-${s.slice(4)}`;
};

/** Step 1 – turn the holder's locked seats into a pending booking + gateway order. */
export async function createPendingBooking(user: User, holderId: string, showId: string) {
  const show = getShow(showId);
  if (!show || show.cancelled) throw new HttpError(404, 'Show not found');
  if (Date.parse(show.startsAt) < Date.now() - 15 * 60_000) throw new HttpError(409, 'This show has already started.');
  const screen = getScreen(show.screenId)!;

  const held = await locks().all(showId);
  const seatIds = [...held].filter(([, v]) => v.holderId === holderId).map(([k]) => k).sort();
  if (!seatIds.length) throw new HttpError(409, 'Your seat hold has expired. Please select seats again.');
  if (seatIds.length > MAX_SEATS) throw new HttpError(422, `You can book up to ${MAX_SEATS} seats at a time.`);

  const blocked = blockedFor(showId, holderId);
  const lost = seatIds.filter((s) => blocked.has(s));
  if (lost.length) throw new HttpError(409, `Seat ${lost.join(', ')} was just taken.`, { lost });

  const pricing = priceSeats(screen.layout, show, seatIds);
  const expiresAt = await locks().extend(showId, holderId, PAYMENT_HOLD_MS);
  if (!expiresAt) throw new HttpError(409, 'Your seat hold has expired.');

  const order = await pay.createOrder(Math.round(pricing.total * 100), `cv_${showId}`.slice(0, 40));
  const now = new Date().toISOString();

  const booking = tx((d) => {
    // supersede any older pending booking from the same holder for this show
    for (const b of d.bookings) if (b.holderId === holderId && b.showId === showId && b.status === 'pending') b.status = 'expired';
    const b: Booking = { id: uid('bk'), code: code(), userId: user.id, holderId, showId, seatIds, pricing, status: 'pending', createdAt: now, expiresAt: new Date(expiresAt).toISOString() };
    d.bookings.push(b);
    d.payments.push({ id: uid('pm'), bookingId: b.id, provider: pay.provider, orderId: order.orderId, amount: Math.round(pricing.total * 100), currency: 'INR', status: 'created', createdAt: now, updatedAt: now });
    return b;
  });
  notifyShow(showId);
  return { booking, orderId: order.orderId, keyId: order.keyId, provider: pay.provider };
}

/**
 * Step 2 – server-side verification, then transaction-safe confirmation.
 * Idempotent: replaying the same payment returns the already-confirmed booking.
 */
export async function confirmPayment(input: { bookingId: string; orderId: string; paymentId: string; signature: string; method?: string }, actorUserId: string | null) {
  const b0 = db().bookings.find((b) => b.id === input.bookingId);
  if (!b0) throw new HttpError(404, 'Booking not found');
  if (actorUserId && b0.userId !== actorUserId) throw new HttpError(403, 'Not your booking');
  const p0 = db().payments.find((p) => p.bookingId === b0.id && p.orderId === input.orderId);
  if (!p0) throw new HttpError(400, 'Order does not match this booking');

  if (!pay.verifySignature(input.orderId, input.paymentId, input.signature)) {
    console.warn(`[payments] signature mismatch for booking ${b0.id}`); // reject only; the order stays payable
    throw new HttpError(400, 'Payment verification failed. You have not been charged for a booking.');
  }
  if (b0.status === 'confirmed' && b0.paymentId === input.paymentId) return b0;

  // Independent gateway check (Razorpay): status + amount + order must match.
  const remote = await pay.fetchPayment(input.paymentId);
  if (remote && (remote.order_id !== input.orderId || remote.amount !== p0.amount || !['captured', 'authorized'].includes(remote.status)))
    throw new HttpError(400, 'Payment could not be verified with the gateway.');

  const now = new Date().toISOString();
  const result = tx((d) => {
    const b = d.bookings.find((x) => x.id === b0.id)!;
    const p = d.payments.find((x) => x.id === p0.id)!;
    if (d.processedEvents.includes(`pay:${input.paymentId}`) && b.status === 'confirmed') return { b, conflict: false };
    p.providerPaymentId = input.paymentId; p.method = input.method || remote?.method || p.method; p.updatedAt = now;
    // The critical invariant: no seat may appear in two confirmed bookings, nor in box-office sales.
    const taken = occupiedSeats(b.showId, d);
    const clash = b.seatIds.filter((s) => taken.has(s));
    if (clash.length || b.status === 'cancelled') {
      b.status = 'failed'; p.status = 'captured';
      return { b, conflict: true };
    }
    b.status = 'confirmed'; b.confirmedAt = now; b.paymentId = p.id;
    p.status = 'captured';
    d.processedEvents.push(`pay:${input.paymentId}`);
    return { b, conflict: false };
  });

  await locks().release(b0.showId, b0.holderId);
  notifyShow(b0.showId);

  if (result.conflict) {
    // Money was taken but seats were lost (hold expired and someone else booked) → auto refund.
    const r = await pay.refund(input.paymentId, p0.amount);
    tx((d) => {
      const b = d.bookings.find((x) => x.id === b0.id)!;
      b.refund = { status: r.status, amount: p0.amount / 100, refId: r.id, at: new Date().toISOString() };
      const p = d.payments.find((x) => x.id === p0.id)!; if (r.status === 'processed') p.status = 'refunded';
    });
    throw new HttpError(409, 'Sorry — your seats were released before payment completed and have since been booked. A full refund has been initiated.');
  }
  return result.b;
}

export function markPaymentFailed(bookingId: string, userId: string, reason: string) {
  return tx((d) => {
    const b = d.bookings.find((x) => x.id === bookingId);
    if (!b || b.userId !== userId) throw new HttpError(404, 'Booking not found');
    const p = d.payments.find((x) => x.bookingId === b.id && (x.status === 'created' || x.status === 'failed'));
    if (p) { p.status = 'failed'; p.failureReason = reason.slice(0, 200); p.updatedAt = new Date().toISOString(); }
    // keep the booking pending so the user can retry while the hold lasts
    return b;
  });
}

/** Cancellation policy: allowed until `theatre.cancellationHours` before showtime; ticket price + ticket GST refunded, fees are not. */
export function cancellationQuote(b: Booking) {
  const show = getShow(b.showId)!;
  const theatre = getTheatre(getScreen(show.screenId)!.theatreId)!;
  const deadline = Date.parse(show.startsAt) - theatre.cancellationHours * 3600_000;
  const allowed = b.status === 'confirmed' && Date.now() < deadline;
  const amount = Math.round((b.pricing.subtotal + b.pricing.gstOnTickets) * 100) / 100;
  return { allowed, deadline: new Date(deadline).toISOString(), amount, hours: theatre.cancellationHours };
}

export async function cancelBooking(bookingId: string, userId: string) {
  const b = db().bookings.find((x) => x.id === bookingId);
  if (!b || b.userId !== userId) throw new HttpError(404, 'Booking not found');
  const q = cancellationQuote(b);
  if (!q.allowed) throw new HttpError(409, `Cancellations close ${q.hours}h before showtime.`);
  const p = db().payments.find((x) => x.id === b.paymentId);
  const r = p?.providerPaymentId ? await pay.refund(p.providerPaymentId, Math.round(q.amount * 100)) : { id: 'n/a', status: 'processed' as const };
  const out = tx((d) => {
    const bb = d.bookings.find((x) => x.id === bookingId)!;
    if (bb.status !== 'confirmed') throw new HttpError(409, 'Booking is not active');
    bb.status = 'cancelled'; bb.cancelledAt = new Date().toISOString();
    bb.refund = { status: r.status, amount: q.amount, refId: r.id, at: bb.cancelledAt };
    const pp = d.payments.find((x) => x.id === bb.paymentId); if (pp && r.status === 'processed') pp.status = 'refunded';
    return bb;
  });
  notifyShow(b.showId);
  return out;
}

export function bookingView(b: Booking) {
  const ctx = showContext(b.showId)!;
  const payment = db().payments.filter((p) => p.bookingId === b.id).sort((x, y) => y.updatedAt.localeCompare(x.updatedAt))[0];
  return {
    booking: b,
    show: ctx.show,
    movie: ctx.movie,
    theatre: ctx.theatre,
    screen: { id: ctx.screen.id, name: ctx.screen.name },
    payment: payment ? { provider: payment.provider, status: payment.status, method: payment.method, orderId: payment.orderId, providerPaymentId: payment.providerPaymentId, amount: payment.amount / 100, failureReason: payment.failureReason } : null,
  };
}
export type BookingView = ReturnType<typeof bookingView>;
