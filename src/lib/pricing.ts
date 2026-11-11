import type { PriceBreakdown, SeatLayout, Show } from './types';
import { computeSeats } from './geometry';

/** Indian cinema pricing: GST 12% on tickets ≤ ₹100, 18% above; convenience fee + 18% GST on the fee. */
export const CONVENIENCE_PER_SEAT = 30;
const round2 = (n: number) => Math.round(n * 100) / 100;

export function seatPrice(layout: SeatLayout, show: Pick<Show, 'priceFactor'>, categoryId: string) {
  const c = layout.categories.find((x) => x.id === categoryId);
  if (!c) throw new Error('Unknown seat category');
  return Math.round(c.price * show.priceFactor);
}

export function priceSeats(layout: SeatLayout, show: Pick<Show, 'priceFactor'>, seatIds: string[]): PriceBreakdown {
  const byId = new Map(computeSeats(layout).map((s) => [s.id, s]));
  const lines = seatIds.map((id) => {
    const s = byId.get(id);
    if (!s) throw new Error(`Seat ${id} does not exist on this screen`);
    const cat = layout.categories.find((c) => c.id === s.categoryId)!;
    return { seatId: id, categoryId: cat.id, categoryName: cat.name, price: seatPrice(layout, show, cat.id) };
  });
  const subtotal = lines.reduce((a, l) => a + l.price, 0);
  const gstOnTickets = round2(lines.reduce((a, l) => a + l.price * (l.price > 100 ? 0.18 : 0.12), 0));
  const convenienceFee = CONVENIENCE_PER_SEAT * lines.length;
  const gstOnFee = round2(convenienceFee * 0.18);
  const total = round2(subtotal + gstOnTickets + convenienceFee + gstOnFee);
  return { lines, subtotal, convenienceFee, gstOnTickets, gstOnFee, total };
}
