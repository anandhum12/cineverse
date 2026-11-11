import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendSeats } from '@/lib/recommend';
import { computeSeats } from '@/lib/geometry';
import { layoutTemplate } from '@/lib/server/seed';
import type { SeatStateMap } from '@/lib/types';

const layout = layoutTemplate('multiplex');
const seats = computeSeats(layout);
const byId = new Map(seats.map((s) => [s.id, s]));
const show = { priceFactor: 1 };

test('never recommends occupied or held seats', () => {
  const states: SeatStateMap = {};
  seats.forEach((s, i) => (states[s.id] = i % 3 === 0 ? 'occupied' : i % 7 === 0 ? 'held' : 'available'));
  for (const pref of ['best', 'closest', 'centre', 'budget', 'couples', 'families'] as const) {
    for (const r of recommendSeats(layout, show, states, pref, 2))
      for (const id of r.seatIds) assert.equal(states[id], 'available', `${pref} picked ${id}`);
  }
});

test('group seats are adjacent in one row with no aisle between them', () => {
  const recs = recommendSeats(layout, show, {}, 'families', 4);
  assert.ok(recs.length > 0);
  for (const r of recs) {
    const g = r.seatIds.map((id) => byId.get(id)!);
    assert.equal(new Set(g.map((s) => s.row)).size, 1);
    const cols = g.map((s) => s.col).sort((a, b) => a - b);
    cols.forEach((c, i) => i && assert.equal(c, cols[i - 1] + 1));
  }
});

test('recliner preference only returns recliner/VIP seats', () => {
  const kinds = new Map(layout.categories.map((c) => [c.id, c.kind]));
  for (const r of recommendSeats(layout, show, {}, 'recliner', 2))
    for (const id of r.seatIds) assert.ok(['recliner', 'vip'].includes(kinds.get(byId.get(id)!.categoryId)!));
});

test('closest-to-screen beats best-overall on distance', () => {
  const close = recommendSeats(layout, show, {}, 'closest', 1)[0];
  const best = recommendSeats(layout, show, {}, 'best', 1)[0];
  assert.ok(close.metrics.distanceM < best.metrics.distanceM);
});

test('returns nothing when the hall is full', () => {
  const full: SeatStateMap = Object.fromEntries(seats.map((s) => [s.id, 'occupied']));
  assert.deepEqual(recommendSeats(layout, show, full, 'best', 2), []);
});
