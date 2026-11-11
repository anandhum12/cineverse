import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import type { Data, User } from '../types';
import { occupiedIn } from '../catalog';
import { CITIES, generateShows, seedMovies, seedTheatres } from './seed';

/**
 * File-backed document store.
 *
 * Why this exists: the target production database is PostgreSQL (see prisma/schema.prisma),
 * but this repo must run with zero infrastructure. Every mutation goes through `tx()`, which runs
 * synchronously inside Node's single thread — so a read-check-write sequence (e.g. "is this seat
 * free? then book it") cannot interleave with another request. That gives the same guarantee as
 * a SERIALIZABLE transaction + UNIQUE(show_id, seat_id) for a single server process.
 * Horizontal scaling requires the Postgres adapter (documented in docs/ARCHITECTURE.md).
 */
export type { Data };

const DATA_VERSION = 3;
const DIR = path.join(process.cwd(), '.data');
const FILE = path.join(DIR, 'db.json');

type G = typeof globalThis & { __cv_db?: { data: Data; timer?: NodeJS.Timeout; showsCheckedAt: number } };
const g = globalThis as G;

function seed(): Data {
  const { theatres, screens } = seedTheatres();
  const movies = seedMovies();
  const now = new Date().toISOString();
  return {
    version: DATA_VERSION,
    movies,
    theatres,
    screens,
    shows: generateShows(movies, screens, 0, 6, new Set()),
    bookings: [],
    payments: [],
    users: [
      { id: 'u_admin', email: 'admin@cineverse.dev', name: 'CineVerse Admin', role: 'admin', provider: 'credentials', passwordHash: bcrypt.hashSync('admin123', 10), favourites: [], createdAt: now },
      { id: 'u_demo', email: 'demo@cineverse.dev', name: 'Demo Viewer', role: 'user', provider: 'credentials', passwordHash: bcrypt.hashSync('demo1234', 10), favourites: ['mv_orbital-drift'], createdAt: now },
    ],
    panoramas: [],
    reviews: [
      { id: 'rv_1', movieId: 'mv_orbital-drift', userId: 'u_demo', userName: 'Demo Viewer', rating: 9, text: 'Saw it in IMAX from row H — the docking sequence is unreal.', createdAt: now },
      { id: 'rv_2', movieId: 'mv_the-last-monsoon', userId: 'u_demo', userName: 'Demo Viewer', rating: 9, text: 'Quietly devastating. The sound design in Atmos is worth it.', createdAt: now },
    ],
    processedEvents: [],
  };
}

function load(): Data {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8')) as Data;
    if (raw.version === DATA_VERSION) return raw;
  } catch { /* first boot or corrupt file → reseed */ }
  const d = seed();
  persistNow(d);
  return d;
}

function persistNow(d: Data) {
  fs.mkdirSync(DIR, { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(d));
  fs.renameSync(tmp, FILE); // atomic replace
}

function state() {
  if (!g.__cv_db) g.__cv_db = { data: load(), showsCheckedAt: 0 };
  const s = g.__cv_db;
  // keep a rolling 7-day window of shows
  if (Date.now() - s.showsCheckedAt > 10 * 60_000) {
    s.showsCheckedAt = Date.now();
    const existing = new Set(s.data.shows.map((x) => x.id));
    const fresh = generateShows(s.data.movies, s.data.screens, 0, 6, existing);
    if (fresh.length) { s.data.shows.push(...fresh); schedule(); }
  }
  return s;
}

function schedule() {
  const s = g.__cv_db!;
  if (s.timer) return;
  s.timer = setTimeout(() => { s.timer = undefined; persistNow(s.data); }, 150);
}

/** Read-only snapshot accessor. Do not mutate the returned objects. */
export function db(): Readonly<Data> {
  return state().data;
}

/** Run a synchronous mutation atomically. Throwing inside `fn` aborts before persisting. */
export function tx<T>(fn: (d: Data) => T): T {
  const s = state();
  // structured clone gives rollback-on-throw semantics
  const draft: Data = structuredCloneSafe(s.data);
  const result = fn(draft);
  s.data = draft;
  schedule();
  return result;
}

function structuredCloneSafe<T>(v: T): T {
  // Node 17+ has structuredClone; Node 16 does not
  const sc = (globalThis as unknown as { structuredClone?: <X>(x: X) => X }).structuredClone;
  return sc ? sc(v) : JSON.parse(JSON.stringify(v));
}

export const uid = (prefix: string) => `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
export const cities = () => CITIES;

// ─── Query helpers ──────────────────────────────────────────────────────────
export const getMovie = (idOrSlug: string) => db().movies.find((m) => m.id === idOrSlug || m.slug === idOrSlug);
export const getShow = (id: string) => db().shows.find((s) => s.id === id);
export const getScreen = (id: string) => db().screens.find((s) => s.id === id);
export const getTheatre = (id: string) => db().theatres.find((t) => t.id === id);
export const getUserByEmail = (email: string) => db().users.find((u) => u.email.toLowerCase() === email.toLowerCase());
export const getUser = (id: string) => db().users.find((u) => u.id === id);

export function showContext(showId: string) {
  const show = getShow(showId);
  if (!show) return null;
  const screen = getScreen(show.screenId)!;
  const theatre = getTheatre(screen.theatreId)!;
  const movie = getMovie(show.movieId)!;
  return { show, screen, theatre, movie };
}

/** Seats permanently taken for a show: confirmed bookings + box-office sales. */
export function occupiedSeats(showId: string, d: Readonly<Data> = db()): Set<string> {
  return occupiedIn(d, showId);
}

export function publicUser(u: User) {
  const { passwordHash: _ph, ...rest } = u;
  return rest;
}
