'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import type { TheatreListing, ShowSlot } from '@/lib/server/catalog';
import type { Movie } from '@/lib/types';
import { useLocation } from '@/lib/store';
import { cx, fmtTime, inr, istDay, timeBucket } from '@/lib/format';
import { Empty, Segmented, Skeleton } from './ui/misc';

const TheatreMap = dynamic(() => import('./TheatreMap'), { ssr: false, loading: () => <Skeleton className="h-full w-full !rounded-3xl" /> });

const BUCKETS = [{ id: 'morning', label: 'Morning' }, { id: 'afternoon', label: 'Afternoon' }, { id: 'evening', label: 'Evening' }, { id: 'night', label: 'Night' }] as const;

function days(n = 6) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.now() + i * 864e5);
    const key = istDay(d);
    return { key, dow: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' }), day: d.toLocaleDateString('en-IN', { day: 'numeric', timeZone: 'Asia/Kolkata' }), mon: d.toLocaleDateString('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' }) };
  });
}

/** Date → theatre → screen/showtime. Used on the movie page (movie set) and the cinemas page (all films). */
export function ShowtimeExplorer({ movie, movies }: { movie?: Movie; movies?: Movie[] }) {
  const loc = useLocation((s) => s.location);
  const openPicker = useLocation((s) => s.openPicker);
  const dates = useMemo(() => days(), []);
  const [date, setDate] = useState(dates[0].key);
  const [data, setData] = useState<TheatreListing[] | null>(null);
  const [view, setView] = useState<'list' | 'map'>('list');
  const [active, setActive] = useState<string | null>(null);
  const [f, setF] = useState({ maxKm: 50, maxPrice: 2000, buckets: [] as string[], language: '', format: '', minRating: 0, sort: 'distance' as 'distance' | 'rating' | 'price' });

  useEffect(() => {
    if (!loc) return;
    setData(null);
    const ctrl = new AbortController();
    const qs = new URLSearchParams({ city: loc.cityId, date, lat: String(loc.lat), lng: String(loc.lng), ...(movie ? { movie: movie.id } : {}) });
    fetch(`/api/theatres?${qs}`, { signal: ctrl.signal }).then((r) => r.json()).then((d) => setData(d.theatres)).catch(() => {});
    return () => ctrl.abort();
  }, [loc, date, movie]);

  const options = useMemo(() => {
    const all = (data ?? []).flatMap((t) => t.shows);
    return { languages: [...new Set(all.map((s) => s.language))].sort(), formats: [...new Set(all.map((s) => s.format))].sort() };
  }, [data]);

  const filtered = useMemo(() => {
    const keep = (s: ShowSlot) => s.minPrice <= f.maxPrice && (!f.buckets.length || f.buckets.includes(timeBucket(s.startsAt))) && (!f.language || s.language === f.language) && (!f.format || s.format === f.format);
    const list = (data ?? [])
      .filter((t) => (t.distanceKm == null || t.distanceKm <= f.maxKm) && t.rating >= f.minRating)
      .map((t) => ({ ...t, shows: t.shows.filter(keep) }))
      .filter((t) => t.shows.length);
    const minP = (t: TheatreListing) => Math.min(...t.shows.map((s) => s.minPrice));
    return list.sort((a, b) => f.sort === 'rating' ? b.rating - a.rating : f.sort === 'price' ? minP(a) - minP(b) : (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  }, [data, f]);

  const activeFilters = (f.maxKm < 50 ? 1 : 0) + (f.maxPrice < 2000 ? 1 : 0) + f.buckets.length + (f.language ? 1 : 0) + (f.format ? 1 : 0) + (f.minRating ? 1 : 0);

  return (
    <div id="showtimes" className="scroll-mt-28">
      {/* Step 1: date */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-2" role="tablist" aria-label="Choose a date">
        {dates.map((d) => (
          <button key={d.key} role="tab" aria-selected={date === d.key} onClick={() => setDate(d.key)}
            className={cx('relative isolate flex w-[74px] shrink-0 flex-col items-center rounded-2xl border py-3 transition focus-ring', date === d.key ? 'border-transparent text-white' : 'border-white/10 text-white/55 hover:border-white/25 hover:text-white')}>
            {date === d.key && <motion.span layoutId="date-pill" className="absolute inset-0 -z-10 rounded-2xl bg-neon-gradient shadow-glow" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />}
            <span className="text-[10px] font-semibold uppercase tracking-widest opacity-80">{d.dow}</span>
            <span className="font-display text-2xl font-bold leading-tight">{d.day}</span>
            <span className="text-[10px] uppercase opacity-70">{d.mon}</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button onClick={() => openPicker(true)} className="chip h-9 hover:border-white/30">📍 {loc?.label ?? 'Set location'}</button>
        <Segmented value={view} onChange={setView} options={[{ id: 'list', label: 'List' }, { id: 'map', label: 'Map' }]} />
        <select aria-label="Sort" value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value as typeof f.sort })} className="h-9 rounded-full border border-white/10 bg-ink-900 px-3 text-xs text-white/80 outline-none focus:border-neon-violet">
          <option value="distance">Nearest first</option><option value="rating">Top rated</option><option value="price">Lowest price</option>
        </select>
        <details className="group relative">
          <summary className="chip h-9 cursor-pointer list-none hover:border-white/30">Filters{activeFilters ? <span className="ml-1 rounded-full bg-neon-violet px-1.5 text-[10px] text-white">{activeFilters}</span> : null}</summary>
          <div className="glass-strong absolute left-0 z-30 mt-2 w-[min(92vw,360px)] space-y-4 rounded-3xl p-5 text-sm">
            <label className="block"><span className="label">Within {f.maxKm} km</span><input type="range" min={1} max={50} value={f.maxKm} onChange={(e) => setF({ ...f, maxKm: +e.target.value })} className="w-full accent-violet-500" /></label>
            <label className="block"><span className="label">Tickets up to {inr(f.maxPrice)}</span><input type="range" min={100} max={2000} step={50} value={f.maxPrice} onChange={(e) => setF({ ...f, maxPrice: +e.target.value })} className="w-full accent-violet-500" /></label>
            <div><span className="label">Show time</span><div className="flex flex-wrap gap-1.5">{BUCKETS.map((b) => (
              <button key={b.id} onClick={() => setF({ ...f, buckets: f.buckets.includes(b.id) ? f.buckets.filter((x) => x !== b.id) : [...f.buckets, b.id] })} className={cx('chip', f.buckets.includes(b.id) && 'border-neon-violet bg-neon-violet/20 text-white')}>{b.label}</button>))}</div></div>
            <div className="grid grid-cols-2 gap-3">
              <label><span className="label">Language</span><select value={f.language} onChange={(e) => setF({ ...f, language: e.target.value })} className="input !py-2"><option value="">Any</option>{options.languages.map((l) => <option key={l}>{l}</option>)}</select></label>
              <label><span className="label">Format</span><select value={f.format} onChange={(e) => setF({ ...f, format: e.target.value })} className="input !py-2"><option value="">Any</option>{options.formats.map((l) => <option key={l}>{l}</option>)}</select></label>
            </div>
            <div><span className="label">Theatre rating</span><div className="flex gap-1.5">{[0, 4, 4.3, 4.6].map((r) => <button key={r} onClick={() => setF({ ...f, minRating: r })} className={cx('chip', f.minRating === r && 'border-neon-violet bg-neon-violet/20 text-white')}>{r ? `${r}+ ★` : 'Any'}</button>)}</div></div>
            <button onClick={() => setF({ maxKm: 50, maxPrice: 2000, buckets: [], language: '', format: '', minRating: 0, sort: f.sort })} className="text-xs text-white/50 underline-offset-4 hover:text-white hover:underline">Reset filters</button>
          </div>
        </details>
      </div>

      <div className={cx('mt-6 grid gap-6', view === 'map' && 'lg:grid-cols-[1fr_420px]')}>
        {view === 'map' && loc && (
          <div className="order-first h-[340px] overflow-hidden rounded-3xl ring-1 ring-white/10 lg:sticky lg:top-24 lg:order-last lg:h-[calc(100vh-140px)]">
            <TheatreMap theatres={filtered} center={[loc.lat, loc.lng]} activeId={active} onSelect={(id) => { setActive(id); document.getElementById(`th-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} />
          </div>
        )}
        <div className="space-y-4">
          {!loc ? <Empty title="Where are you watching?"><button className="underline" onClick={() => openPicker(true)}>Set your location</button> to see nearby cinemas.</Empty>
            : !data ? Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-40 w-full !rounded-3xl" />)
            : !filtered.length ? <Empty title="No shows match">Try another date, widen the distance, or reset filters.</Empty>
            : (
              <AnimatePresence initial={false}>
                {filtered.map((t, i) => (
                  <motion.article id={`th-${t.id}`} key={t.id} layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.04 }}
                    onMouseEnter={() => setActive(t.id)} className={cx('glass rounded-3xl p-5 transition sm:p-6', active === t.id && 'ring-1 ring-neon-violet/50')}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-display text-lg font-semibold">{t.name}</h3>
                        <p className="mt-1 text-xs text-white/50">{t.address}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">{t.facilities.slice(0, 5).map((x) => <span key={x} className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/50">{x}</span>)}</div>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        {t.distanceKm != null && <span className="chip">{t.distanceKm} km</span>}
                        <span className="chip text-amber-300">★ {t.rating}</span>
                      </div>
                    </div>
                    {movie ? <Slots shows={t.shows} /> : (
                      <div className="mt-4 space-y-4">
                        {[...new Set(t.shows.map((s) => s.movieId))].map((mid) => {
                          const m = movies?.find((x) => x.id === mid);
                          return m ? <div key={mid}><Link href={`/movies/${m.slug}`} className="text-sm font-semibold text-white/85 hover:text-white">{m.title} <span className="text-xs font-normal text-white/40">· {m.certification} · {m.genres[0]}</span></Link><Slots shows={t.shows.filter((s) => s.movieId === mid)} /></div> : null;
                        })}
                      </div>
                    )}
                    <p className="mt-4 text-[11px] text-white/35">Cancellation available up to {t.cancellationHours}h before showtime</p>
                  </motion.article>
                ))}
              </AnimatePresence>
            )}
        </div>
      </div>
    </div>
  );
}

function Slots({ shows }: { shows: ShowSlot[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2.5">
      {shows.map((s) => {
        const ratio = s.available / s.total;
        const tone = ratio < 0.15 ? 'text-rose-300' : ratio < 0.4 ? 'text-amber-300' : 'text-emerald-300';
        return (
          <Link key={s.id} href={`/book/${s.id}`} className="group relative min-w-[118px] rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-2.5 transition hover:-translate-y-0.5 hover:border-neon-violet/60 hover:bg-neon-violet/10 hover:shadow-glow focus-ring">
            <span className="block font-display text-[15px] font-semibold">{fmtTime(s.startsAt)}</span>
            <span className="block text-[10px] uppercase tracking-wider text-white/50">{s.format} · {s.language}</span>
            <span className="mt-1 flex items-center justify-between gap-2 text-[10px]"><span className={tone}>{s.available} left</span><span className="text-white/45">from {inr(s.minPrice)}</span></span>
            <span className="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-black/90 px-2 py-1 text-[10px] text-white/80 group-hover:block">{s.screenName} · {inr(s.minPrice)}–{inr(s.maxPrice)}</span>
          </Link>
        );
      })}
    </div>
  );
}
