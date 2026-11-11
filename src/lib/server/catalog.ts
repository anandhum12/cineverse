import { computeSeats } from '../geometry';
import { haversineKm, istDay } from '../format';
import { seatPrice } from '../pricing';
import type { ScreenFormat } from '../types';
import { db, occupiedSeats } from './db';

export interface ShowSlot { id: string; startsAt: string; format: ScreenFormat; language: string; screenName: string; minPrice: number; maxPrice: number; available: number; total: number; movieId: string }
export interface TheatreListing {
  id: string; name: string; area: string; address: string; lat: number; lng: number; rating: number; facilities: string[]; cancellationHours: number;
  distanceKm: number | null; shows: ShowSlot[];
}

export function theatreListings(q: { cityId?: string; movieId?: string; date?: string; lat?: number; lng?: number }): TheatreListing[] {
  const d = db();
  const now = Date.now();
  const screensById = new Map(d.screens.map((s) => [s.id, s]));
  const seatCount = new Map(d.screens.map((s) => [s.id, computeSeats(s.layout).length]));
  const out: TheatreListing[] = [];
  for (const t of d.theatres) {
    if (q.cityId && t.cityId !== q.cityId) continue;
    const screenIds = new Set(d.screens.filter((s) => s.theatreId === t.id).map((s) => s.id));
    const shows = d.shows
      .filter((s) => screenIds.has(s.screenId) && !s.cancelled && (!q.movieId || s.movieId === q.movieId) && (!q.date || istDay(s.startsAt) === q.date) && Date.parse(s.startsAt) > now - 10 * 60_000)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .map((s) => {
        const sc = screensById.get(s.screenId)!;
        const prices = sc.layout.categories.map((c) => seatPrice(sc.layout, s, c.id));
        const total = seatCount.get(sc.id)!;
        return { id: s.id, movieId: s.movieId, startsAt: s.startsAt, format: s.format, language: s.language, screenName: sc.name, minPrice: Math.min(...prices), maxPrice: Math.max(...prices), total, available: total - occupiedSeats(s.id, d).size };
      });
    if (q.movieId && !shows.length) continue;
    const distanceKm = q.lat != null && q.lng != null && !Number.isNaN(q.lat) ? Math.round(haversineKm({ lat: q.lat, lng: q.lng! }, t) * 10) / 10 : null;
    out.push({ id: t.id, name: t.name, area: t.area, address: t.address, lat: t.lat, lng: t.lng, rating: t.rating, facilities: t.facilities, cancellationHours: t.cancellationHours, distanceKm, shows });
  }
  return out.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0) || b.rating - a.rating);
}

export function moviesInCity(cityId: string) {
  const d = db();
  const theatreIds = new Set(d.theatres.filter((t) => t.cityId === cityId).map((t) => t.id));
  const screenIds = new Set(d.screens.filter((s) => theatreIds.has(s.theatreId)).map((s) => s.id));
  const now = Date.now();
  const count = new Map<string, number>();
  for (const s of d.shows) if (screenIds.has(s.screenId) && Date.parse(s.startsAt) > now) count.set(s.movieId, (count.get(s.movieId) ?? 0) + 1);
  return [...count].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}
