'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Movie, Panorama, Screen, SeatStateMap, Show, Theatre } from '@/lib/types';
import { computeSeats, viewMetrics, type SeatGeo } from '@/lib/geometry';
import { priceSeats, seatPrice } from '@/lib/pricing';
import { api, ApiError } from '@/lib/client';
import { fmtDate, fmtTime, inr } from '@/lib/format';
import { toast, useSeatUI } from '@/lib/store';
import { SeatMap, SeatLegend } from './SeatMap';
import { Recommender } from './Recommender';
import { HoldTimer } from './HoldTimer';
import { Skeleton } from '../ui/misc';
import { Button } from '../ui/Button';

const ImmersiveView = dynamic(() => import('../immersive/ImmersiveView'), { ssr: false });

interface ShowData { show: Show; movie: Movie; theatre: Theatre; screen: Screen; states: SeatStateMap; hold: { seatIds: string[]; expiresAt: number } | null; panoramas: Panorama[] }

export function BookingExperience({ showId }: { showId: string }) {
  const [data, setData] = useState<ShowData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [states, setStates] = useState<SeatStateMap>({});
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const ui = useSeatUI();
  const { status } = useSession();
  const router = useRouter();
  const pendingHold = useRef<Promise<unknown> | null>(null);

  // initial load
  useEffect(() => {
    ui.reset(showId);
    api<ShowData>(`/api/shows/${showId}`).then((d) => {
      setData(d); setStates(d.states);
      if (d.hold) { ui.setSelected(d.hold.seatIds); ui.setHold(d.hold.expiresAt); }
    }).catch((e) => setError((e as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showId]);

  // live seat updates (SSE, auto-reconnects)
  useEffect(() => {
    const es = new EventSource(`/api/shows/${showId}/stream`);
    es.addEventListener('seats', (e) => { setStates(JSON.parse((e as MessageEvent).data)); setLive(true); });
    es.onerror = () => setLive(false);
    return () => es.close();
  }, [showId]);

  // reconcile: if one of my seats got taken (or my hold expired), drop it locally
  useEffect(() => {
    const mine = useSeatUI.getState().selected;
    const lost = mine.filter((id) => states[id] && states[id] !== 'mine' && states[id] !== 'available');
    const exp = useSeatUI.getState().holdExpiresAt;
    const expired = mine.length > 0 && !!exp && exp <= Date.now() + 500 && !pendingHold.current;
    if (lost.length) { ui.setSelected(mine.filter((x) => !lost.includes(x))); toast('error', `Seat ${lost.join(', ')} is no longer available.`); }
    else if (expired) { ui.setSelected([]); ui.setHold(null); toast('info', 'Your seat hold expired, so the seats were released.'); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [states]);

  const seats = useMemo(() => (data ? computeSeats(data.screen.layout) : []), [data]);
  const seatById = useMemo(() => new Map(seats.map((s) => [s.id, s])), [seats]);

  /** Server hold is the source of truth; optimistic locally, reverted on conflict. */
  const commit = useCallback(async (next: string[]) => {
    const prev = useSeatUI.getState().selected;
    ui.setSelected(next);
    const p = api<{ seatIds: string[]; expiresAt: number | null }>(`/api/shows/${showId}/hold`, { method: 'POST', json: { seatIds: next } });
    pendingHold.current = p;
    try {
      const r = await p;
      if (pendingHold.current === p) { ui.setHold(r.expiresAt); }
      return true;
    } catch (e) {
      if (pendingHold.current === p) ui.setSelected(prev);
      toast('error', e instanceof ApiError ? e.message : 'Could not hold seats. Check your connection.');
      return false;
    } finally { if (pendingHold.current === p) pendingHold.current = null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showId]);

  const onSeat = (s: SeatGeo, o: { x: number; y: number }) => {
    setOrigin(o);
    const sel = useSeatUI.getState().selected;
    if (sel.includes(s.id)) { commit(sel.filter((x) => x !== s.id)); ui.focus(sel.length > 1 ? sel.find((x) => x !== s.id)! : null); return; }
    if (sel.length >= 10) return toast('info', 'You can select up to 10 seats.');
    ui.focus(s.id); ui.setHighlight([]);
    commit([...sel, s.id]);
  };

  const openPreview = (id: string) => {
    if (!origin.x) setOrigin({ x: innerWidth / 2, y: innerHeight / 2 });
    ui.preview(id);
  };

  const proceed = async () => {
    if (!ui.selected.length) return;
    if (status !== 'authenticated') { router.push(`/login?next=${encodeURIComponent(`/book/${showId}`)}`); return; }
    setBusy(true);
    try {
      if (pendingHold.current) await pendingHold.current;
      const r = await api<{ bookingId: string }>('/api/bookings', { method: 'POST', json: { showId } });
      router.push(`/checkout/${r.bookingId}`);
    } catch (e) { toast('error', (e as Error).message); setBusy(false); }
  };

  if (error) return <div className="container-x pt-40 text-center"><p className="font-display text-2xl">{error}</p><Link href="/" className="mt-4 inline-block text-neon-violet underline">Back to movies</Link></div>;
  if (!data) return <div className="container-x pt-32"><Skeleton className="h-10 w-80" /><div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]"><Skeleton className="h-[62vh] !rounded-3xl" /><Skeleton className="h-[62vh] !rounded-3xl" /></div></div>;

  const { show, movie, theatre, screen } = data;
  const layout = screen.layout;
  const focused = ui.focused ? seatById.get(ui.focused) : undefined;
  const fm = focused ? viewMetrics(focused, layout.geometry) : null;
  const pricing = ui.selected.length ? priceSeats(layout, show, ui.selected.filter((x) => seatById.has(x))) : null;
  const shownStates: SeatStateMap = { ...states };
  ui.selected.forEach((id) => (shownStates[id] = 'mine'));

  return (
    <div className="pb-32 pt-24 lg:pb-12">
      <div className="container-x">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href={`/movies/${movie.slug}#showtimes`} className="text-xs text-white/50 hover:text-white">← {movie.title}</Link>
            <h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">{theatre.name} <span className="text-white/40">· {screen.name}</span></h1>
            <p className="mt-1 text-sm text-white/55">{fmtDate(show.startsAt, { weekday: 'long', day: 'numeric', month: 'long' })} · {fmtTime(show.startsAt)} · {show.format} · {show.language}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-[11px] text-white/45"><span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-emerald-400' : 'bg-white/30'}`} />{live ? 'Live availability' : 'Connecting…'}</span>
            <HoldTimer expiresAt={ui.selected.length ? ui.holdExpiresAt : null} />
          </div>
        </motion.div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="space-y-4">
            <div className="glass relative overflow-hidden rounded-[2rem]">
              <SeatMap layout={layout} show={show} states={shownStates} selected={ui.selected} highlight={ui.highlight} focused={ui.focused} onSeat={onSeat} className="h-[58vh] min-h-[380px] w-full lg:h-[66vh]" />
              <p className="pointer-events-none absolute left-4 top-4 hidden text-[11px] text-white/35 sm:block">Drag to pan · pinch or ⌘/Ctrl + scroll to zoom</p>
            </div>
            <SeatLegend layout={layout} />
            <div className="flex flex-wrap gap-2 text-xs text-white/50">
              {layout.categories.map((c) => <span key={c.id} className="chip">{c.name} · {inr(seatPrice(layout, show, c.id))}</span>)}
            </div>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <AnimatePresence mode="wait">
              {focused && fm ? (
                <motion.div key={focused.id} initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }} className="glass relative overflow-hidden rounded-3xl p-5">
                  <div aria-hidden className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-neon-violet/30 blur-3xl" />
                  <div className="relative flex items-start justify-between">
                    <div><p className="eyebrow">Seat {focused.row} · {focused.number}</p><p className="font-display text-4xl font-bold">{focused.id}</p></div>
                    <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs">{fm.quality} · {fm.score}</span>
                  </div>
                  <div className="relative mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-2xl bg-white/[0.04] p-2"><p className="text-white/45">Distance</p><p className="font-semibold">{fm.distanceM.toFixed(1)} m</p></div>
                    <div className="rounded-2xl bg-white/[0.04] p-2"><p className="text-white/45">Screen fills</p><p className="font-semibold">{Math.round(fm.subtendedDeg)}°</p></div>
                    <div className="rounded-2xl bg-white/[0.04] p-2"><p className="text-white/45">Off-centre</p><p className="font-semibold">{Math.abs(Math.round(fm.horizontalOffsetDeg))}°</p></div>
                  </div>
                  <button onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setOrigin({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); ui.preview(focused.id); }}
                    className="group relative mt-4 flex h-14 w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-neon-gradient font-semibold shadow-glow focus-ring">
                    <span className="absolute inset-0 animate-shimmer bg-[linear-gradient(110deg,transparent_30%,rgba(255,255,255,.3)_50%,transparent_70%)] bg-[length:200%_100%]" />
                    <svg className="relative" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
                    <span className="relative">Experience this seat: 180° view</span>
                  </button>
                </motion.div>
              ) : (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-3xl p-5 text-sm text-white/55">
                  <p className="font-display text-lg text-white">Pick a seat</p>
                  <p className="mt-1">Tap any available seat to hold it and see its viewing metrics. Then step inside with the 180° view.</p>
                </motion.div>
              )}
            </AnimatePresence>

            <Recommender showId={showId} onHighlight={(ids) => ui.setHighlight(ids)} onApply={(ids) => { commit(ids); ui.focus(ids[Math.floor(ids.length / 2)]); ui.setHighlight([]); }} onPreview={openPreview} />

            <div className="glass hidden rounded-3xl p-5 lg:block"><Summary pricing={pricing} busy={busy} onProceed={proceed} selected={ui.selected} /></div>
          </aside>
        </div>
      </div>

      {/* mobile sticky summary */}
      <div className="glass-strong fixed inset-x-0 bottom-0 z-40 rounded-t-3xl p-4 lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0"><p className="truncate text-sm font-semibold">{ui.selected.length ? ui.selected.join(', ') : 'No seats selected'}</p><p className="text-xs text-white/50">{pricing ? `${inr(pricing.total)} incl. fees & taxes` : 'Tap a seat to begin'}</p></div>
          <Button onClick={proceed} disabled={!ui.selected.length} loading={busy}>Proceed</Button>
        </div>
      </div>

      <AnimatePresence>
        {ui.previewSeat && (
          <ImmersiveView key="iv" layout={layout} show={show} movie={movie} states={shownStates} selected={ui.selected} seatId={ui.previewSeat} panoramas={data.panoramas} origin={origin}
            onSeatChange={(id) => ui.preview(id)}
            onClose={() => ui.preview(null)}
            onSelect={async (id) => {
              const sel = useSeatUI.getState().selected;
              const ok = sel.includes(id) || (await commit([...sel, id].slice(-10)));
              if (ok) { ui.focus(id); ui.preview(null); toast('success', `Seat ${id} selected.`); }
            }} />
        )}
      </AnimatePresence>
    </div>
  );
}

function Summary({ pricing, busy, onProceed, selected }: { pricing: ReturnType<typeof priceSeats> | null; busy: boolean; onProceed: () => void; selected: string[] }) {
  return (
    <div>
      <h3 className="font-display text-lg font-semibold">Your seats</h3>
      {!pricing ? <p className="mt-2 text-sm text-white/50">No seats selected yet.</p> : (
        <>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            <AnimatePresence>{selected.map((s) => <motion.li key={s} layout initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} className="rounded-lg bg-neon-violet/20 px-2 py-1 text-xs font-semibold text-violet-100">{s}</motion.li>)}</AnimatePresence>
          </ul>
          <dl className="mt-4 space-y-1.5 text-sm">
            {Object.entries(pricing.lines.reduce<Record<string, { n: number; p: number }>>((a, l) => { a[l.categoryName] = { n: (a[l.categoryName]?.n ?? 0) + 1, p: l.price }; return a; }, {})).map(([k, v]) => (
              <div key={k} className="flex justify-between text-white/70"><dt>{k} × {v.n}</dt><dd>{inr(v.p * v.n)}</dd></div>
            ))}
            <div className="flex justify-between text-white/50"><dt>Convenience fee</dt><dd>{inr(pricing.convenienceFee)}</dd></div>
            <div className="flex justify-between text-white/50"><dt>GST</dt><dd>{inr(pricing.gstOnTickets + pricing.gstOnFee)}</dd></div>
            <div className="flex justify-between border-t border-white/10 pt-2 text-base font-semibold"><dt>Total</dt><dd>{inr(pricing.total)}</dd></div>
          </dl>
        </>
      )}
      <div className="mt-4"><Button onClick={onProceed} disabled={!selected.length} loading={busy} className="w-full" size="lg">Proceed to checkout</Button></div>
    </div>
  );
}
