'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { CITIES, nearestCity } from '@/lib/cities';
import { haversineKm } from '@/lib/format';
import { useLocation } from '@/lib/store';
import { Button } from './ui/Button';

/** First-visit location prompt + reusable city/area picker. */
export function LocationGate() {
  const { prompted, pickerOpen, openPicker, set, location } = useLocation();
  const [hydrated, setHydrated] = useState(false);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'idle' | 'locating' | 'denied' | 'unsupported'>('idle');
  useEffect(() => { if (useLocation.persist.hasHydrated()) setHydrated(true); return useLocation.persist.onFinishHydration(() => setHydrated(true)); }, []);
  const path = usePathname();
  const open = hydrated && (pickerOpen || (!prompted && !path?.startsWith('/admin') && !path?.startsWith('/tickets')));

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    const items = CITIES.flatMap((c) => [
      { key: c.id, title: c.name, sub: c.state, cityId: c.id, lat: c.lat, lng: c.lng },
      ...c.areas.map((a) => ({ key: `${c.id}:${a.name}`, title: a.name, sub: c.name, cityId: c.id, lat: a.lat, lng: a.lng })),
    ]);
    return t ? items.filter((i) => `${i.title} ${i.sub}`.toLowerCase().includes(t)).slice(0, 8) : [];
  }, [q]);

  const locate = () => {
    if (!('geolocation' in navigator)) return setStatus('unsupported');
    setStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const { latitude: lat, longitude: lng } = p.coords;
        const c = nearestCity(lat, lng);
        const far = haversineKm({ lat, lng }, c) > 80;
        // If the user is far from every supported city, centre on that city instead of their raw position.
        set({ mode: 'gps', cityId: c.id, label: far ? `${c.name} (nearest)` : `Near you · ${c.name}`, lat: far ? c.lat : lat, lng: far ? c.lng : lng });
        setStatus('idle');
      },
      () => setStatus('denied'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  };

  const close = () => {
    if (!location) set({ mode: 'manual', cityId: 'kochi', label: 'Kochi', lat: CITIES[0].lat, lng: CITIES[0].lng });
    else openPicker(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={close} />
          <motion.div role="dialog" aria-modal="true" aria-label="Choose your location" className="glass-strong relative w-full max-w-xl overflow-hidden rounded-t-[2rem] p-6 sm:rounded-[2rem] sm:p-8"
            initial={{ y: 60, opacity: 0, scale: 0.97 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 28 }}>
            <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-neon-violet/30 blur-3xl" />
            <div className="relative mx-auto mb-5 grid h-16 w-16 place-items-center">
              <span className="absolute inset-0 animate-pulse-ring rounded-full border border-neon-violet/60" />
              <span className="absolute inset-2 animate-pulse-ring rounded-full border border-neon-blue/50 [animation-delay:.6s]" />
              <span className="h-4 w-4 rounded-full bg-neon-gradient shadow-glow" />
            </div>
            <h2 className="text-center font-display text-2xl font-bold">Find cinemas near you</h2>
            <p className="mx-auto mt-2 max-w-sm text-center text-sm text-white/55">We use your approximate location only to sort nearby theatres by distance. It stays on this device.</p>
            <div className="mt-6 flex justify-center">
              <Button onClick={locate} loading={status === 'locating'} magnetic size="lg">Use my location</Button>
            </div>
            {status === 'denied' && <p className="mt-3 text-center text-xs text-amber-200/80">Location permission was denied. Pick your city below instead.</p>}
            {status === 'unsupported' && <p className="mt-3 text-center text-xs text-amber-200/80">Your browser does not support location. Pick your city below.</p>}

            <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-white/30"><span className="h-px flex-1 bg-white/10" />or choose<span className="h-px flex-1 bg-white/10" /></div>
            <label className="sr-only" htmlFor="loc-q">Search city or area</label>
            <input id="loc-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a city or neighbourhood…" className="input" autoComplete="off" />
            {results.length > 0 && (
              <ul className="mt-2 max-h-56 overflow-auto rounded-2xl border border-white/10 bg-black/30 p-1">
                {results.map((r) => (
                  <li key={r.key}><button onClick={() => set({ mode: 'manual', cityId: r.cityId, label: r.title === r.sub ? r.title : `${r.title}, ${r.sub}`, lat: r.lat, lng: r.lng })} className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm hover:bg-white/[0.07]">
                    <span>{r.title}</span><span className="text-xs text-white/40">{r.sub}</span></button></li>
                ))}
              </ul>
            )}
            <div className="mt-4 grid grid-cols-3 gap-2">
              {CITIES.map((c) => (
                <button key={c.id} onClick={() => set({ mode: 'manual', cityId: c.id, label: c.name, lat: c.lat, lng: c.lng })}
                  className={`rounded-2xl border px-3 py-3 text-sm transition hover:border-neon-violet/60 hover:bg-white/[0.05] focus-ring ${location?.cityId === c.id ? 'border-neon-violet/70 bg-neon-violet/10' : 'border-white/10'}`}>{c.name}</button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
