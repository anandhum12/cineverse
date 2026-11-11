import type { SeatStateMap } from '../types';
import { computeSeats } from '../geometry';
import { db, getScreen, getShow, occupiedSeats } from './db';
import { bus, locks } from './locks';

/** Seats belonging to pending (awaiting payment) bookings are also unavailable to others. */
function pendingSeats(showId: string) {
  const now = Date.now();
  const m = new Map<string, string>();
  for (const b of db().bookings)
    if (b.showId === showId && b.status === 'pending' && Date.parse(b.expiresAt) > now) b.seatIds.forEach((s) => m.set(s, b.holderId));
  return m;
}

export function blockedFor(showId: string, holderId: string) {
  const blocked = occupiedSeats(showId);
  for (const [s, h] of pendingSeats(showId)) if (h !== holderId) blocked.add(s);
  return blocked;
}

export async function seatStates(showId: string, holderId: string | null): Promise<SeatStateMap> {
  const show = getShow(showId);
  if (!show) return {};
  const screen = getScreen(show.screenId)!;
  const occupied = occupiedSeats(showId);
  const held = await locks().all(showId);
  const pending = pendingSeats(showId);
  const out: SeatStateMap = {};
  for (const s of computeSeats(screen.layout)) {
    if (occupied.has(s.id)) out[s.id] = 'occupied';
    else if (pending.has(s.id)) out[s.id] = pending.get(s.id) === holderId ? 'mine' : 'held';
    else if (held.has(s.id)) out[s.id] = held.get(s.id)!.holderId === holderId ? 'mine' : 'held';
    else out[s.id] = 'available';
  }
  return out;
}

export function notifyShow(showId: string) {
  bus().emit(`show:${showId}`);
}
