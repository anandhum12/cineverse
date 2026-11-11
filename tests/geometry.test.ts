import test from 'node:test';
import assert from 'node:assert/strict';
import { computeSeats, viewMetrics, validateLayout } from '@/lib/geometry';
import { layoutTemplate } from '@/lib/server/seed';
import { priceSeats } from '@/lib/pricing';

const layout = layoutTemplate('multiplex');
const seats = computeSeats(layout);

test('every row/seat produces a unique seat id', () => {
  assert.equal(new Set(seats.map((s) => s.id)).size, seats.length);
  assert.ok(seats.length > 150);
});

test('rows recede from the screen and rise with the rake', () => {
  const a = seats.find((s) => s.id === 'A9')!, f = seats.find((s) => s.id === 'F9')!;
  assert.ok(f.z > a.z, 'row F is further than row A');
  assert.ok(f.floorY > a.floorY, 'row F sits higher than row A');
});

test('a centre seat is on-axis; an edge seat is off-axis', () => {
  const row = seats.filter((s) => s.row === 'H').sort((p, q) => Math.abs(p.x) - Math.abs(q.x));
  const centre = viewMetrics(row[0], layout.geometry), edge = viewMetrics(row[row.length - 1], layout.geometry);
  assert.ok(Math.abs(centre.horizontalOffsetDeg) < 3);
  assert.ok(Math.abs(edge.horizontalOffsetDeg) > 15);
  assert.ok(centre.score > edge.score);
});

test('front row has the largest field of view and the most neck strain', () => {
  const a = viewMetrics(seats.find((s) => s.id === 'A9')!, layout.geometry);
  const j = viewMetrics(seats.find((s) => s.id === 'J9')!, layout.geometry);
  assert.ok(a.subtendedDeg > j.subtendedDeg);
  assert.ok(a.topElevationDeg > j.topElevationDeg);
});

test('layout validation catches unknown categories and duplicate rows', () => {
  const bad = { ...layout, rows: [...layout.rows, { ...layout.rows[0] }, { label: 'Z', categoryId: 'nope', cells: [{ t: 's' as const, n: 1 }] }] };
  const errs = validateLayout(bad);
  assert.ok(errs.some((e) => e.includes('Duplicate row')));
  assert.ok(errs.some((e) => e.includes('unknown category')));
  assert.deepEqual(validateLayout(layout), []);
});

test('pricing applies 12%/18% GST by ticket price and GST on the fee', () => {
  const cheap = { ...layout, categories: layout.categories.map((c) => ({ ...c, price: 100 })) };
  const p = priceSeats(cheap, { priceFactor: 1 }, ['A1', 'A2']);
  assert.equal(p.subtotal, 200);
  assert.equal(p.gstOnTickets, 24);       // 12% on ≤ ₹100
  assert.equal(p.convenienceFee, 60);
  assert.equal(p.gstOnFee, 10.8);
  assert.equal(p.total, 294.8);
  const dear = priceSeats(layout, { priceFactor: 1 }, ['H5']);
  assert.equal(dear.gstOnTickets, Math.round(dear.subtotal * 0.18 * 100) / 100);
  assert.throws(() => priceSeats(layout, { priceFactor: 1 }, ['Z99']));
});
