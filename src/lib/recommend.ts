import { computeSeats, viewMetrics, type SeatGeo, type ViewMetrics } from './geometry';
import type { SeatLayout, SeatStateMap, Show } from './types';
import { seatPrice } from './pricing';

export type Preference = 'best' | 'closest' | 'centre' | 'recliner' | 'budget' | 'couples' | 'families';

export const PREFERENCES: { id: Preference; label: string; hint: string }[] = [
  { id: 'best', label: 'Best overall', hint: 'Ideal field of view, on-axis, low neck strain' },
  { id: 'closest', label: 'Closest to screen', hint: 'Maximum immersion' },
  { id: 'centre', label: 'Centre seating', hint: 'Middle of the hall, on the centre line' },
  { id: 'recliner', label: 'Premium recliner', hint: 'Recliner & VIP rows only' },
  { id: 'budget', label: 'Budget-friendly', hint: 'Lowest price with a good view' },
  { id: 'couples', label: 'Best for couples', hint: 'Side-by-side pair, quieter edge of a block' },
  { id: 'families', label: 'Best for families', hint: 'Seats together, close to an aisle' },
];

export interface Recommendation {
  seatIds: string[];
  score: number;
  avgQuality: number;
  pricePerSeat: number;
  reason: string;
  metrics: ViewMetrics;
}

interface Win { seats: SeatGeo[]; metrics: ViewMetrics[]; nearAisle: boolean; atBlockEdge: boolean }

/** Enumerate every run of `n` available seats with no aisle between them. */
function windows(layout: SeatLayout, seats: SeatGeo[], states: SeatStateMap, n: number): Win[] {
  const byRow = new Map<number, SeatGeo[]>();
  for (const s of seats) {
    if (!byRow.has(s.rowIndex)) byRow.set(s.rowIndex, []);
    byRow.get(s.rowIndex)!.push(s);
  }
  const out: Win[] = [];
  for (const [ri, rowSeats] of byRow) {
    rowSeats.sort((a, b) => a.col - b.col);
    const cells = layout.rows[ri].cells;
    for (let i = 0; i + n <= rowSeats.length; i++) {
      const w = rowSeats.slice(i, i + n);
      let ok = true;
      for (let k = 0; k < w.length; k++) {
        const st = states[w[k].id] ?? 'available';
        if (st !== 'available' && st !== 'mine') { ok = false; break; }
        if (k > 0 && w[k].col !== w[k - 1].col + 1) { ok = false; break; } // aisle splits the group
      }
      if (!ok) continue;
      const first = w[0].col, last = w[w.length - 1].col;
      const nearAisle = cells[first - 1]?.t === 'g' || cells[last + 1]?.t === 'g' || first === 0 || last === cells.length - 1;
      const atBlockEdge = nearAisle;
      out.push({ seats: w, metrics: w.map((s) => viewMetrics(s, layout.geometry)), nearAisle, atBlockEdge });
    }
  }
  return out;
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

export function recommendSeats(layout: SeatLayout, show: Pick<Show, 'priceFactor'>, states: SeatStateMap, pref: Preference, partySize: number, limit = 3): Recommendation[] {
  const n = Math.max(1, Math.min(10, pref === 'couples' ? Math.max(2, partySize) : partySize));
  const seats = computeSeats(layout);
  const kind = new Map(layout.categories.map((c) => [c.id, c.kind]));
  const prices = layout.categories.map((c) => seatPrice(layout, show, c.id));
  const maxPrice = Math.max(...prices), minPrice = Math.min(...prices);
  const midRow = (layout.rows.length - 1) * 0.6;

  let ws = windows(layout, seats, states, n);
  if (pref === 'recliner') ws = ws.filter((w) => w.seats.every((s) => ['recliner', 'vip'].includes(kind.get(s.categoryId)!)));

  const scored = ws.map((w) => {
    const q = avg(w.metrics.map((m) => m.score));
    const dist = avg(w.metrics.map((m) => m.distanceM));
    const off = Math.abs(avg(w.metrics.map((m) => m.horizontalOffsetDeg)));
    const price = seatPrice(layout, show, w.seats[0].categoryId);
    const priceNorm = maxPrice === minPrice ? 0 : (price - minPrice) / (maxPrice - minPrice);
    const isLux = ['recliner', 'vip'].includes(kind.get(w.seats[0].categoryId)!);
    let score = q;
    let reason = '';
    switch (pref) {
      case 'best':
        score = q - off * 0.15; reason = `${Math.round(q)}/100 view score, ${Math.round(off)}° off-centre`; break;
      case 'closest':
        score = 100 - dist * 4 + q * 0.15; reason = `${dist.toFixed(1)} m from the screen`; break;
      case 'centre':
        score = 100 - off * 3 - Math.abs(w.seats[0].rowIndex - midRow) * 5; reason = `${Math.round(off)}° from the centre line, middle of the hall`; break;
      case 'recliner':
        score = q + (kind.get(w.seats[0].categoryId) === 'vip' ? 4 : 0); reason = `${layout.categories.find((c) => c.id === w.seats[0].categoryId)?.name} · ${Math.round(q)}/100 view`; break;
      case 'budget':
        score = q * 0.45 + (1 - priceNorm) * 60; reason = `Lower-priced tier with a ${Math.round(q)}/100 view`; break;
      case 'couples':
        score = q + (w.atBlockEdge ? 8 : 0) + (isLux ? 6 : 0); reason = `${w.atBlockEdge ? 'Edge of a block for privacy · ' : ''}${Math.round(q)}/100 view`; break;
      case 'families':
        score = q + (w.nearAisle ? 10 : 0) - (w.seats[0].rowIndex < 2 ? 15 : 0); reason = `${n} seats together${w.nearAisle ? ', next to an aisle' : ''}`; break;
    }
    return { w, score, q, price, reason };
  });

  scored.sort((a, b) => b.score - a.score);
  const used = new Set<string>();
  const out: Recommendation[] = [];
  for (const s of scored) {
    if (s.w.seats.some((x) => used.has(x.id))) continue;
    s.w.seats.forEach((x) => used.add(x.id));
    const mid = s.w.metrics[Math.floor(s.w.metrics.length / 2)];
    out.push({ seatIds: s.w.seats.map((x) => x.id), score: Math.round(s.score), avgQuality: Math.round(s.q), pricePerSeat: s.price, reason: s.reason, metrics: mid });
    if (out.length >= limit) break;
  }
  return out;
}
