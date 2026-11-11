import test from 'node:test';
import assert from 'node:assert/strict';
import { locks } from '@/lib/server/locks';
import { db, tx, occupiedSeats } from '@/lib/server/db';
import { confirmPayment } from '@/lib/server/bookings';
import { sandboxCharge } from '@/lib/server/payments';
import { priceSeats } from '@/lib/pricing';
import type { Booking } from '@/lib/types';

test('seat locks are exclusive, replaceable and expire', async () => {
  const L = locks();
  const a = await L.hold('t1', 'alice', ['A1', 'A2'], 60_000, new Set());
  assert.ok(a.ok);
  const b = await L.hold('t1', 'bob', ['A2', 'A3'], 60_000, new Set());
  assert.equal(b.ok, false);
  assert.deepEqual(b.conflicts, ['A2']);
  // alice changes her mind: A2 released, B1 taken
  assert.ok((await L.hold('t1', 'alice', ['A1', 'B1'], 60_000, new Set())).ok);
  assert.ok((await L.hold('t1', 'bob', ['A2'], 60_000, new Set())).ok);
  // blocked (sold) seats are refused
  assert.equal((await L.hold('t1', 'carol', ['C1'], 60_000, new Set(['C1']))).ok, false);
  // expiry
  await L.hold('t2', 'dave', ['D1'], 5, new Set());
  await new Promise((r) => setTimeout(r, 20));
  assert.ok((await L.hold('t2', 'erin', ['D1'], 60_000, new Set())).ok);
});

/** Simulates the worst case: two users paid for the same seat (e.g. a hold expired mid-payment). */
test('two bookings can never both confirm the same seat', async () => {
  const show = db().shows[0];
  const screen = db().screens.find((s) => s.id === show.screenId)!;
  const free = screen.layout.rows.flatMap((r) => r.cells.filter((c) => c.t === 's').map((c) => `${r.label}${(c as { n: number }).n}`)).find((id) => !occupiedSeats(show.id).has(id))!;
  const pricing = priceSeats(screen.layout, show, [free]);
  const mk = (n: string): { b: Booking; order: string } => {
    const order = `order_sbx_test${n}`;
    const b: Booking = { id: `bk_test${n}`, code: `CV-TEST-${n}`, userId: 'u_demo', holderId: `h${n}`, showId: show.id, seatIds: [free], pricing, status: 'pending', createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString() };
    tx((d) => { d.bookings.push(b); d.payments.push({ id: `pm_test${n}`, bookingId: b.id, provider: 'sandbox', orderId: order, amount: Math.round(pricing.total * 100), currency: 'INR', status: 'created', createdAt: b.createdAt, updatedAt: b.createdAt }); });
    return { b, order };
  };
  const one = mk('1'), two = mk('2');
  const pay = (o: string) => { const r = sandboxCharge(o, 'success'); assert.ok(r.ok); return r as { paymentId: string; signature: string }; };
  const p1 = pay(one.order), p2 = pay(two.order);

  const results = await Promise.allSettled([
    confirmPayment({ bookingId: one.b.id, orderId: one.order, paymentId: p1.paymentId, signature: p1.signature }, 'u_demo'),
    confirmPayment({ bookingId: two.b.id, orderId: two.order, paymentId: p2.paymentId, signature: p2.signature }, 'u_demo'),
  ]);
  const ok = results.filter((r) => r.status === 'fulfilled');
  const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
  assert.equal(ok.length, 1, 'exactly one confirmation');
  assert.equal(failed.length, 1);
  assert.match(String(failed[0].reason.message), /refund/i);
  const confirmed = db().bookings.filter((b) => b.showId === show.id && b.status === 'confirmed' && b.seatIds.includes(free));
  assert.equal(confirmed.length, 1);
  const loser = db().bookings.find((b) => b.id === (confirmed[0].id === one.b.id ? two.b.id : one.b.id))!;
  assert.equal(loser.status, 'failed');
  assert.equal(loser.refund?.status, 'processed');
});

test('a forged signature never confirms a booking', async () => {
  const show = db().shows[1];
  const screen = db().screens.find((s) => s.id === show.screenId)!;
  const pricing = priceSeats(screen.layout, show, ['A1']);
  tx((d) => {
    d.bookings.push({ id: 'bk_forge', code: 'CV-FORG-E', userId: 'u_demo', holderId: 'hf', showId: show.id, seatIds: ['A1'], pricing, status: 'pending', createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString() });
    d.payments.push({ id: 'pm_forge', bookingId: 'bk_forge', provider: 'sandbox', orderId: 'order_sbx_forge', amount: 100, currency: 'INR', status: 'created', createdAt: '', updatedAt: '' });
  });
  await assert.rejects(confirmPayment({ bookingId: 'bk_forge', orderId: 'order_sbx_forge', paymentId: 'pay_x', signature: 'deadbeef' }, 'u_demo'), /verification failed/);
  await assert.rejects(confirmPayment({ bookingId: 'bk_forge', orderId: 'order_sbx_forge', paymentId: 'pay_x', signature: 'deadbeef' }, 'u_someone_else'), /Not your booking/);
  assert.equal(db().bookings.find((b) => b.id === 'bk_forge')!.status, 'pending');
});
