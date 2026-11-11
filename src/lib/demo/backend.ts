/**
 * In-browser backend for the GitHub Pages demo.
 *
 * GitHub Pages only serves static files, so this module answers the same /api/* requests the UI
 * makes against the real server, using the same shared domain code (pricing, geometry, seat
 * recommendations, catalogue queries, admin validation). Data lives in this browser's localStorage:
 * each visitor has a private copy, sign-in is demo-only, and payments use a simulated gateway.
 */
import type { Booking, Data, Panorama, SeatStateMap, User } from '../types';
import { generateShows, seedMovies, seedTheatres } from '../server/seed';
import { listTheatres, moviesInCityOf, occupiedIn } from '../catalog';
import { computeSeats } from '../geometry';
import { priceSeats } from '../pricing';
import { recommendSeats, PREFERENCES, type Preference } from '../recommend';
import { RESOURCES } from '../server/admin';
import { istDay } from '../format';

const KEY = 'cineverse-demo-v1';
const VERSION = 1;
const HOLD_MS = 7 * 60_000;
const PAY_MS = 10 * 60_000;

type DemoData = Data & { session: string | null; passwords: Record<string, string> };
export class DemoError extends Error { constructor(public status: number, message: string, public details?: unknown) { super(message); } }

let data: DemoData | null = null;
const holds = new Map<string, Map<string, number>>(); // showId → seat → expiresAt (this visitor only)
const listeners = new Set<() => void>();
const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

function seed(): DemoData {
  const { theatres, screens } = seedTheatres();
  const movies = seedMovies();
  const now = new Date().toISOString();
  return {
    version: VERSION, movies, theatres, screens, shows: generateShows(movies, screens, 0, 6, new Set()),
    bookings: [], payments: [], panoramas: [], processedEvents: [],
    users: [
      { id: 'u_admin', email: 'admin@cineverse.dev', name: 'CineVerse Admin', role: 'admin', provider: 'credentials', favourites: [], createdAt: now },
      { id: 'u_demo', email: 'demo@cineverse.dev', name: 'Demo Viewer', role: 'user', provider: 'credentials', favourites: ['mv_orbital-drift'], createdAt: now },
    ],
    // Demo-only accounts that exist solely in this browser.
    passwords: { 'admin@cineverse.dev': 'admin123', 'demo@cineverse.dev': 'demo1234' },
    reviews: [{ id: 'rv_1', movieId: 'mv_orbital-drift', userId: 'u_demo', userName: 'Demo Viewer', rating: 9, text: 'Saw it in IMAX from row H. The docking sequence is unreal.', createdAt: now }],
    session: null,
  };
}

function load(): DemoData {
  if (data) return data;
  if (typeof window === 'undefined') throw new DemoError(500, 'Demo backend runs in the browser only');
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw?.version === VERSION) data = raw;
  } catch { /* corrupt → reseed */ }
  if (!data) data = seed();
  // keep a rolling 7-day schedule and drop old shows nobody booked (bounds storage)
  const d = data;
  const fresh = generateShows(d.movies, d.screens, 0, 6, new Set(d.shows.map((s) => s.id)));
  d.shows.push(...fresh);
  const booked = new Set(d.bookings.map((b) => b.showId));
  const cutoff = Date.now() - 864e5;
  d.shows = d.shows.filter((s) => Date.parse(s.startsAt) > cutoff || booked.has(s.id));
  save();
  return d;
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); }
  catch { throw new DemoError(507, 'Browser storage is full. Remove uploaded images or reset the demo.'); }
}
function commit() { save(); listeners.forEach((l) => l()); }

// ─── helpers ────────────────────────────────────────────────────────────────
function me(d = load()) { return d.session ? d.users.find((u) => u.id === d.session) ?? null : null; }
function requireUser() { const u = me(); if (!u) throw new DemoError(401, 'Please sign in to continue.'); return u; }
function requireAdmin() { const u = requireUser(); if (u.role !== 'admin') throw new DemoError(403, 'You do not have access to this area.'); return u; }
function ctx(showId: string) {
  const d = load();
  const show = d.shows.find((s) => s.id === showId);
  if (!show) throw new DemoError(404, 'Show not found');
  const screen = d.screens.find((s) => s.id === show.screenId)!;
  return { d, show, screen, theatre: d.theatres.find((t) => t.id === screen.theatreId)!, movie: d.movies.find((m) => m.id === show.movieId)! };
}
function myHolds(showId: string) {
  const t = holds.get(showId) ?? new Map<string, number>();
  const now = Date.now();
  for (const [k, v] of t) if (v <= now) t.delete(k);
  holds.set(showId, t);
  return t;
}
function pendingMine(d: DemoData, showId: string) {
  return d.bookings.filter((b) => b.showId === showId && b.status === 'pending' && Date.parse(b.expiresAt) > Date.now());
}
function states(showId: string): SeatStateMap {
  const { d, screen } = ctx(showId);
  const occ = occupiedIn(d, showId);
  const mine = new Set([...myHolds(showId).keys(), ...pendingMine(d, showId).flatMap((b) => b.seatIds)]);
  const out: SeatStateMap = {};
  for (const s of computeSeats(screen.layout)) out[s.id] = occ.has(s.id) ? 'occupied' : mine.has(s.id) ? 'mine' : 'available';
  return out;
}
function view(b: Booking) {
  const { show, movie, theatre, screen, d } = ctx(b.showId);
  const p = d.payments.filter((x) => x.bookingId === b.id).sort((x, y) => y.updatedAt.localeCompare(x.updatedAt))[0];
  return { booking: b, show, movie, theatre, screen: { id: screen.id, name: screen.name },
    payment: p ? { provider: p.provider, status: p.status, method: p.method, orderId: p.orderId, providerPaymentId: p.providerPaymentId, amount: p.amount / 100, failureReason: p.failureReason } : null };
}
function quote(b: Booking) {
  const { show, theatre } = ctx(b.showId);
  const deadline = Date.parse(show.startsAt) - theatre.cancellationHours * 3600_000;
  return { allowed: b.status === 'confirmed' && Date.now() < deadline, deadline: new Date(deadline).toISOString(), amount: Math.round((b.pricing.subtotal + b.pricing.gstOnTickets) * 100) / 100, hours: theatre.cancellationHours };
}
const pub = (u: User) => { const { passwordHash: _p, ...r } = u; return r; };
const code = () => 'CV-' + Array.from({ length: 8 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('').replace(/^(.{4})/, '$1-');

function validate<T>(schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: { flatten: () => unknown } } }, v: unknown): T {
  const r = schema.safeParse(v);
  if (!r.success) throw new DemoError(422, 'Invalid input', r.error!.flatten());
  return r.data as T;
}

// ─── request router ─────────────────────────────────────────────────────────
type Body = Record<string, unknown>;
async function route(method: string, url: URL, body: Body): Promise<unknown> {
  const p = url.pathname.replace(/\/+$/, '').split('/').slice(2); // after /api
  const q = url.searchParams;
  const d = load();
  const [a, b, c] = p;

  if (a === 'movies' && !b && method === 'GET') return { movies: d.movies };
  if (a === 'movies' && b === 'near') return { movieIds: moviesInCityOf(d, q.get('city') || 'kochi') };
  if (a === 'theatres') {
    const n = (k: string) => (q.get(k) ? Number(q.get(k)) : undefined);
    return { theatres: listTheatres(d, { cityId: q.get('city') || undefined, movieId: q.get('movie') || undefined, date: q.get('date') || undefined, lat: n('lat'), lng: n('lng') }) };
  }

  if (a === 'shows' && b) {
    const x = ctx(b);
    if (!c && method === 'GET') {
      const h = myHolds(b);
      return { show: { ...x.show, soldOffline: undefined }, movie: x.movie, theatre: x.theatre, screen: x.screen, states: states(b),
        hold: h.size ? { seatIds: [...h.keys()], expiresAt: Math.min(...h.values()) } : null, panoramas: d.panoramas.filter((pn) => pn.screenId === x.screen.id) };
    }
    if (c === 'hold' && method === 'POST') {
      const seatIds = [...new Set((body.seatIds as string[]) ?? [])];
      if (seatIds.length > 10) throw new DemoError(422, 'You can select up to 10 seats.');
      const valid = new Set(computeSeats(x.screen.layout).map((s) => s.id));
      const bad = seatIds.filter((s) => !valid.has(s));
      if (bad.length) throw new DemoError(422, `Unknown seat ${bad.join(', ')}`);
      const taken = seatIds.filter((s) => occupiedIn(d, b).has(s));
      if (taken.length) throw new DemoError(409, `Seat ${taken.join(', ')} was just taken.`, { conflicts: taken });
      const exp = Date.now() + HOLD_MS;
      holds.set(b, new Map(seatIds.map((s) => [s, exp])));
      listeners.forEach((l) => l());
      return { seatIds, expiresAt: seatIds.length ? exp : null };
    }
    if (c === 'hold' && method === 'DELETE') { holds.delete(b); listeners.forEach((l) => l()); return { released: true }; }
    if (c === 'recommend') {
      const pref = (q.get('pref') || 'best') as Preference;
      if (!PREFERENCES.some((pp) => pp.id === pref)) throw new DemoError(422, 'Unknown preference');
      return { recommendations: recommendSeats(x.screen.layout, x.show, states(b), pref, Math.max(1, Math.min(10, Number(q.get('party')) || 2))) };
    }
  }

  if (a === 'bookings') {
    const u = requireUser();
    if (!b && method === 'GET') return { bookings: d.bookings.filter((x) => x.userId === u.id && x.status !== 'expired').map(view) };
    if (!b && method === 'POST') {
      const showId = String(body.showId);
      const x = ctx(showId);
      if (Date.parse(x.show.startsAt) < Date.now() - 15 * 60_000) throw new DemoError(409, 'This show has already started.');
      const seatIds = [...myHolds(showId).keys()].sort();
      if (!seatIds.length) throw new DemoError(409, 'Your seat hold has expired. Please select seats again.');
      const lost = seatIds.filter((s) => occupiedIn(d, showId).has(s));
      if (lost.length) throw new DemoError(409, `Seat ${lost.join(', ')} was just taken.`);
      const pricing = priceSeats(x.screen.layout, x.show, seatIds);
      const expiresAt = new Date(Date.now() + PAY_MS).toISOString();
      for (const k of seatIds) myHolds(showId).set(k, Date.parse(expiresAt));
      d.bookings.forEach((bk) => { if (bk.showId === showId && bk.status === 'pending' && bk.userId === u.id) bk.status = 'expired'; });
      const now = new Date().toISOString();
      const bk: Booking = { id: `bk_${rid()}`, code: code(), userId: u.id, holderId: 'demo', showId, seatIds, pricing, status: 'pending', createdAt: now, expiresAt };
      d.bookings.push(bk);
      d.payments.push({ id: `pm_${rid()}`, bookingId: bk.id, provider: 'sandbox', orderId: `order_demo_${rid()}`, amount: Math.round(pricing.total * 100), currency: 'INR', status: 'created', createdAt: now, updatedAt: now });
      commit();
      return { bookingId: bk.id };
    }
    const bk = d.bookings.find((x) => x.id === b);
    if (!bk || (bk.userId !== u.id && u.role !== 'admin')) throw new DemoError(404, 'Booking not found');
    if (!c && method === 'GET') return { ...view(bk), cancellation: quote(bk), gateway: { provider: 'sandbox', keyId: null, sandbox: true }, user: { name: u.name, email: u.email } };
    if (c === 'cancel') {
      const qt = quote(bk);
      if (!qt.allowed) throw new DemoError(409, `Cancellations close ${qt.hours}h before showtime.`);
      bk.status = 'cancelled'; bk.cancelledAt = new Date().toISOString();
      bk.refund = { status: 'processed', amount: qt.amount, refId: `rfnd_demo_${rid()}`, at: bk.cancelledAt };
      const pm = d.payments.find((x) => x.id === bk.paymentId); if (pm) pm.status = 'refunded';
      commit();
      return { booking: bk };
    }
  }

  if (a === 'payments') {
    const u = requireUser();
    const bk = d.bookings.find((x) => x.id === body.bookingId && x.userId === u.id);
    if (!bk) throw new DemoError(404, 'Booking not found');
    const pm = d.payments.find((x) => x.bookingId === bk.id && (x.status === 'created' || x.status === 'failed'));
    if (b === 'sandbox') {
      if (!pm) throw new DemoError(409, 'No open payment for this booking');
      await new Promise((r) => setTimeout(r, 900));
      if (body.outcome === 'failure') throw new DemoError(402, 'Payment declined by bank (simulated)');
      return { razorpay_order_id: pm.orderId, razorpay_payment_id: `pay_demo_${rid()}`, razorpay_signature: 'demo' };
    }
    if (b === 'verify') {
      if (bk.status === 'confirmed') return { bookingId: bk.id, status: bk.status };
      if (!pm || pm.orderId !== body.razorpay_order_id) throw new DemoError(400, 'Order does not match this booking');
      const now = new Date().toISOString();
      if (bk.seatIds.some((s) => occupiedIn(d, bk.showId).has(s))) { bk.status = 'failed'; pm.status = 'refunded'; commit(); throw new DemoError(409, 'Those seats were booked meanwhile. A full refund was issued (simulated).'); }
      bk.status = 'confirmed'; bk.confirmedAt = now; bk.paymentId = pm.id;
      Object.assign(pm, { status: 'captured', providerPaymentId: String(body.razorpay_payment_id), method: (body.method as string) || 'upi', updatedAt: now });
      holds.delete(bk.showId);
      commit();
      return { bookingId: bk.id, status: bk.status };
    }
    if (b === 'failed') { if (pm) { pm.status = 'failed'; pm.failureReason = String(body.reason || 'Payment failed').slice(0, 200); commit(); } return { ok: true }; }
  }

  if (a === 'favourites') {
    const u = requireUser(); const id = String(body.movieId);
    u.favourites = u.favourites.includes(id) ? u.favourites.filter((x) => x !== id) : [...u.favourites, id];
    commit(); return { favourites: u.favourites };
  }
  if (a === 'me') {
    const u = requireUser();
    if (method === 'PATCH') {
      if (typeof body.name === 'string' && body.name.trim().length >= 2) u.name = body.name.trim().slice(0, 60);
      if (body.paymentPreference !== undefined) u.paymentPreference = body.paymentPreference as User['paymentPreference'];
      commit();
    }
    return { user: pub(u) };
  }
  if (a === 'auth' && b === 'register') {
    const email = String(body.email || '').trim().toLowerCase(); const name = String(body.name || '').trim(); const pw = String(body.password || '');
    if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || pw.length < 8) throw new DemoError(422, 'Enter a name, a valid email and a password of at least 8 characters.');
    if (d.users.some((x) => x.email === email)) throw new DemoError(409, 'An account with this email already exists.');
    const u: User = { id: `u_${rid()}`, email, name, role: 'user', provider: 'credentials', favourites: [], createdAt: new Date().toISOString() };
    d.users.push(u); d.passwords[email] = pw; commit();
    return { user: pub(u) };
  }

  if (a === 'admin') {
    requireAdmin();
    if (b === 'stats') return stats(d);
    if (b === 'bookings') {
      const st = q.get('status');
      return { items: d.bookings.filter((x) => (!st || x.status === st) && x.status !== 'expired').sort((x, y) => y.createdAt.localeCompare(x.createdAt)).map((x) => { const u = d.users.find((uu) => uu.id === x.userId); return { ...view(x), user: { name: u?.name, email: u?.email } }; }) };
    }
    const r = RESOURCES[b];
    if (!r) throw new DemoError(404, 'Unknown resource');
    const coll = d[r.coll] as unknown as { id: string }[];
    if (!c && method === 'GET') {
      if (r.coll === 'users') return { items: d.users.map(pub) };
      if (r.coll === 'shows') {
        const th = q.get('theatreId'); const scr = th ? new Set(d.screens.filter((s) => s.theatreId === th).map((s) => s.id)) : null;
        return { items: d.shows.filter((s) => (!scr || scr.has(s.screenId)) && Date.parse(s.startsAt) > Date.now() - 6 * 3600_000).sort((x, y) => x.startsAt.localeCompare(y.startsAt)).slice(0, 500).map((s) => ({ ...s, soldOffline: s.soldOffline.length })) };
      }
      if (r.coll === 'panoramas' && q.get('screenId')) return { items: d.panoramas.filter((pn) => pn.screenId === q.get('screenId')) };
      return { items: coll };
    }
    if (!c && method === 'POST') {
      if (!r.create) throw new DemoError(404, 'Unknown resource');
      const v = validate<Body>(r.create, body);
      if (b === 'shows') {
        const mv = d.movies.find((m) => m.id === v.movieId);
        if (!mv || !d.screens.some((s) => s.id === v.screenId)) throw new DemoError(422, 'Unknown movie or screen');
        const start = Date.parse(String(v.startsAt)), end = start + (mv.durationMin + 20) * 60_000;
        const clash = d.shows.find((x) => x.screenId === v.screenId && !x.cancelled && start < Date.parse(x.startsAt) + ((d.movies.find((m) => m.id === x.movieId)?.durationMin ?? 150) + 20) * 60_000 && Date.parse(x.startsAt) < end);
        if (clash) throw new DemoError(409, `Overlaps an existing show at ${new Date(clash.startsAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
      }
      const item = { id: `${r.prefix}_${rid()}`, ...(r.build ? r.build(v, d) : v) };
      coll.push(item); commit();
      return { item };
    }
    const i = coll.findIndex((x) => x.id === c);
    if (i < 0) throw new DemoError(404, 'Not found');
    if (method === 'PUT') {
      const v = validate<Body>(r.update, body);
      if (b === 'users' && c === me()?.id && v.role !== 'admin') throw new DemoError(409, 'You cannot remove your own admin access.');
      if (b === 'shows' && v.startsAt) v.startsAt = new Date(String(v.startsAt)).toISOString();
      coll[i] = { ...coll[i], ...v }; commit();
      return { item: coll[i] };
    }
    if (method === 'DELETE') {
      const reason = r.guardDelete?.(String(c), d);
      if (reason) throw new DemoError(409, reason);
      coll.splice(i, 1); commit();
      return { deleted: true };
    }
  }
  throw new DemoError(404, `No demo handler for ${method} ${url.pathname}`);
}

function stats(d: DemoData) {
  const conf = d.bookings.filter((b) => b.status === 'confirmed' || (b.status === 'cancelled' && b.confirmedAt));
  const gross = conf.reduce((s, b) => s + b.pricing.total, 0);
  const refunds = d.bookings.reduce((s, b) => s + (b.refund?.amount ?? 0), 0);
  const days = Array.from({ length: 14 }, (_, i) => istDay(new Date(Date.now() - (13 - i) * 864e5)));
  const byMovie = new Map<string, { title: string; revenue: number; tickets: number }>();
  for (const b of conf) {
    const m = d.movies.find((x) => x.id === d.shows.find((s) => s.id === b.showId)?.movieId); if (!m) continue;
    const e = byMovie.get(m.id) ?? { title: m.title, revenue: 0, tickets: 0 }; e.revenue += b.pricing.total; e.tickets += b.seatIds.length; byMovie.set(m.id, e);
  }
  return {
    gross, refunds, net: gross - refunds, bookings: d.bookings.filter((b) => b.status === 'confirmed').length, tickets: conf.reduce((s, b) => s + b.seatIds.length, 0),
    users: d.users.length, movies: d.movies.length, theatres: d.theatres.length, screens: d.screens.length,
    upcomingShows: d.shows.filter((s) => Date.parse(s.startsAt) > Date.now() && !s.cancelled).length,
    failedPayments: d.payments.filter((p) => p.status === 'failed').length,
    byDay: days.map((day) => { const bs = conf.filter((b) => istDay(b.confirmedAt!) === day); return { day, revenue: bs.reduce((s, b) => s + b.pricing.total, 0), tickets: bs.reduce((s, b) => s + b.seatIds.length, 0) }; }),
    topMovies: [...byMovie.values()].sort((x, y) => y.revenue - x.revenue).slice(0, 6),
  };
}

// ─── public API ─────────────────────────────────────────────────────────────
let cachedUser: { key: string; v: { id: string; name: string; email: string; role: 'user' | 'admin' } } | null = null;

export const demo = {
  async request(method: string, url: string, body?: unknown) {
    const res = await route(method.toUpperCase(), new URL(url, 'http://demo.local'), (body ?? {}) as Body);
    return JSON.parse(JSON.stringify(res)); // callers get copies, never live store objects
  },
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  data(): Readonly<Data> { return load(); },
  currentUser() {
    if (typeof window === 'undefined') return null;
    const u = me();
    if (!u) return (cachedUser = null);
    const key = `${u.id}|${u.name}|${u.role}`;
    if (cachedUser?.key !== key) cachedUser = { key, v: { id: u.id, name: u.name, email: u.email, role: u.role } };
    return cachedUser.v;
  },
  login(email: string, password: string): string | null {
    const d = load(); const e = email.trim().toLowerCase();
    if (d.passwords[e] !== password) return 'Incorrect email or password.';
    d.session = d.users.find((u) => u.email === e)!.id; commit(); return null;
  },
  logout() { const d = load(); d.session = null; holds.clear(); commit(); },
  reset() { localStorage.removeItem(KEY); data = null; holds.clear(); load(); commit(); },
  async upload(file: File): Promise<string> {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new DemoError(422, 'The demo accepts JPEG, PNG or WebP images.');
    if (file.size > 1.5 * 1024 * 1024) throw new DemoError(422, 'In the demo, images must be under 1.5 MB (they are stored in your browser).');
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new DemoError(500, 'Could not read file')); r.readAsDataURL(file); });
  },
};
export type { Panorama };
