import { z } from 'zod';
import type { Data } from './db';
import { validateLayout } from '../geometry';
import { layoutTemplate } from './seed';
import type { SeatLayout } from '../types';

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const url = z.string().max(500).refine((v) => v === '' || v.startsWith('/media/') || /^https:\/\//.test(v), 'Must be an https URL or an uploaded file').nullable().optional();
const FORMATS = ['2D', '3D', 'IMAX', 'IMAX 3D', 'Dolby Atmos', '4DX'] as const;

export const MovieSchema = z.object({
  title: z.string().trim().min(1).max(100), tagline: z.string().trim().max(160).default(''), synopsis: z.string().trim().max(2000).default(''),
  genres: z.array(z.string().trim().min(1).max(30)).min(1).max(6), durationMin: z.number().int().min(30).max(300),
  languages: z.array(z.string().trim().min(1).max(30)).min(1).max(8), certification: z.enum(['U', 'UA', 'UA13+', 'UA16+', 'A', 'S']),
  rating: z.number().min(0).max(10), votes: z.number().int().min(0).default(0), ratingSource: z.string().max(60).default('CineVerse verified audience'),
  releaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), status: z.enum(['now', 'soon']), formats: z.array(z.enum(FORMATS)).min(1),
  director: z.string().trim().max(80).default(''), cast: z.array(z.object({ name: z.string().max(80), role: z.string().max(80) })).max(40).default([]),
  crew: z.array(z.object({ name: z.string().max(80), role: z.string().max(80) })).max(40).default([]),
  posterUrl: url, backdropUrl: url, trailerUrl: url,
  palette: z.tuple([hex, hex, hex]), motif: z.enum(['orb', 'rings', 'waves', 'grid', 'monolith', 'rain', 'sun']), trending: z.number().min(0).max(100).default(50),
});

export const TheatreSchema = z.object({
  name: z.string().trim().min(2).max(100), brand: z.string().trim().max(60).default(''), cityId: z.string().min(1), area: z.string().trim().max(60),
  address: z.string().trim().max(200), lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), rating: z.number().min(0).max(5),
  facilities: z.array(z.string().max(40)).max(20).default([]), cancellationHours: z.number().int().min(0).max(72).default(2),
});

const Cell = z.union([z.object({ t: z.literal('s'), n: z.number().int().min(1).max(999), acc: z.boolean().optional() }), z.object({ t: z.literal('g') })]);
export const LayoutSchema = z.object({
  rows: z.array(z.object({ label: z.string(), categoryId: z.string(), cells: z.array(Cell).max(60), walkwayAfter: z.boolean().optional() })).min(1).max(40),
  categories: z.array(z.object({ id: z.string().regex(/^[a-z0-9]{2,12}$/), name: z.string().min(1).max(30), kind: z.enum(['standard', 'premium', 'recliner', 'vip']), price: z.number().min(1).max(10000) })).min(1).max(8),
  geometry: z.object({ screenWidthM: z.number(), screenHeightM: z.number(), screenElevationM: z.number().min(0).max(5), firstRowDistanceM: z.number(), rowSpacingM: z.number(), seatWidthM: z.number(), rakeM: z.number().min(0).max(1), curvature: z.number().min(0).max(0.05), walkwayDepthM: z.number().min(0.5).max(4) }),
  exits: z.array(z.object({ side: z.enum(['left', 'right', 'rear']), rowIndex: z.number().int().min(0) })).max(12),
}).superRefine((l, ctx) => { for (const e of validateLayout(l as SeatLayout)) ctx.addIssue({ code: 'custom', message: e }); });

export const ScreenSchema = z.object({
  theatreId: z.string(), name: z.string().trim().min(1).max(40), formats: z.array(z.enum(FORMATS)).min(1),
  layout: LayoutSchema.optional(), template: z.enum(['imax', 'multiplex', 'lux']).optional(),
});

export const ShowSchema = z.object({
  movieId: z.string(), screenId: z.string(), startsAt: z.string().datetime({ offset: true }), language: z.string().min(1).max(30),
  format: z.enum(FORMATS), priceFactor: z.number().min(0.5).max(3).default(1), cancelled: z.boolean().optional(),
});

export const PanoramaSchema = z.object({
  screenId: z.string(), url: z.string().refine((v) => v.startsWith('/media/') || v.startsWith('https://'), 'Upload an image first'),
  projection: z.enum(['180', '360']), zone: z.object({ rows: z.array(z.string().regex(/^[A-Z]{1,2}$/)).max(40), side: z.enum(['left', 'centre', 'right', 'any']) }),
  yawOffsetDeg: z.number().min(-180).max(180).default(0), capturedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}/), label: z.string().trim().min(1).max(60),
});

export const UserPatchSchema = z.object({ role: z.enum(['user', 'admin']) });

type Coll = 'movies' | 'theatres' | 'screens' | 'shows' | 'panoramas' | 'users';
export const RESOURCES: Record<string, { coll: Coll; create?: z.ZodTypeAny; update: z.ZodTypeAny; prefix: string; build?: (v: any, d: Data) => any; guardDelete?: (id: string, d: Data) => string | null }> = {
  movies: { coll: 'movies', create: MovieSchema, update: MovieSchema.partial(), prefix: 'mv',
    build: (v, d) => { let slug = slugify(v.title); if (d.movies.some((m) => m.slug === slug)) slug += '-' + Date.now().toString(36).slice(-4); return { ...v, slug, createdAt: new Date().toISOString() }; },
    guardDelete: (id, d) => (d.shows.some((s) => s.movieId === id && Date.parse(s.startsAt) > Date.now() && !s.cancelled) ? 'This movie has upcoming shows. Cancel them first.' : null) },
  theatres: { coll: 'theatres', create: TheatreSchema, update: TheatreSchema.partial(), prefix: 'th',
    guardDelete: (id, d) => (d.screens.some((s) => s.theatreId === id) ? 'Remove this theatre’s screens first.' : null) },
  screens: { coll: 'screens', create: ScreenSchema, update: ScreenSchema.partial(), prefix: 'sc',
    build: (v) => { const { template, ...rest } = v; return { ...rest, layout: rest.layout ?? layoutTemplate(template ?? 'multiplex') }; },
    guardDelete: (id, d) => (d.shows.some((s) => s.screenId === id && Date.parse(s.startsAt) > Date.now() && !s.cancelled) ? 'This screen has upcoming shows.' : null) },
  shows: { coll: 'shows', create: ShowSchema, update: ShowSchema.partial(), prefix: 'sh', build: (v) => ({ ...v, startsAt: new Date(v.startsAt).toISOString(), soldOffline: [] }),
    guardDelete: (id, d) => (d.bookings.some((b) => b.showId === id && b.status === 'confirmed') ? 'This show has confirmed bookings. Mark it cancelled instead.' : null) },
  panoramas: { coll: 'panoramas', create: PanoramaSchema, update: PanoramaSchema.partial(), prefix: 'pn', build: (v) => ({ ...v, createdAt: new Date().toISOString() }) },
  users: { coll: 'users', update: UserPatchSchema, prefix: 'u' },
};
