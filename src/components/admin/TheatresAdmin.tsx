'use client';
import Link from 'next/link';
import { useState } from 'react';
import type { Screen, Theatre } from '@/lib/types';
import { CITIES } from '@/lib/cities';
import { computeSeats } from '@/lib/geometry';
import { useAdmin } from './useAdmin';
import { Field, PageHead } from './ui';
import { Modal, Skeleton } from '../ui/misc';
import { Button } from '../ui/Button';
import { routes } from '@/lib/routes';

const blank = (): Partial<Theatre> => ({ name: '', brand: '', cityId: 'kochi', area: '', address: '', lat: CITIES[0].lat, lng: CITIES[0].lng, rating: 4.2, facilities: ['M-Ticket'], cancellationHours: 2 });

export function TheatresAdmin() {
  const th = useAdmin<Theatre>('theatres');
  const sc = useAdmin<Screen>('screens');
  const [edit, setEdit] = useState<Partial<Theatre> | null>(null);
  const [newScreen, setNewScreen] = useState<{ theatreId: string; name: string; template: 'imax' | 'multiplex' | 'lux'; formats: string[] } | null>(null);
  const [city, setCity] = useState('');
  if (!th.items || !sc.items) return <Skeleton className="h-96" />;
  const list = th.items.filter((t) => !city || t.cityId === city);
  return (
    <div>
      <PageHead title="Theatres & screens" sub="Cinemas, screens, seating layouts and 180° previews">
        <select className="input !w-auto !py-2" value={city} onChange={(e) => setCity(e.target.value)} aria-label="Filter by city"><option value="">All cities</option>{CITIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <Button onClick={() => setEdit(blank())}>Add theatre</Button>
      </PageHead>
      <div className="grid gap-4 xl:grid-cols-2">
        {list.map((t) => (
          <div key={t.id} className="glass rounded-2xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div><h3 className="font-semibold">{t.name}</h3><p className="text-xs text-white/45">{t.address}</p><p className="mt-1 text-xs text-white/45">★ {t.rating} · cancel ≥{t.cancellationHours}h · {t.facilities.join(', ')}</p></div>
              <div className="flex shrink-0 gap-1"><button onClick={() => setEdit(t)} className="chip">Edit</button><button onClick={() => th.remove(t.id)} className="chip text-rose-300">Delete</button></div>
            </div>
            <div className="mt-4 space-y-2">
              {sc.items!.filter((s) => s.theatreId === t.id).map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2 text-sm">
                  <span><b>{s.name}</b> <span className="text-white/45">· {s.formats.join(', ')} · {computeSeats(s.layout).length} seats · {s.layout.geometry.screenWidthM} m screen</span></span>
                  <span className="flex gap-1"><Link href={routes.adminScreen(s.id)} className="chip">Layout & 180°</Link><button onClick={() => sc.remove(s.id)} className="chip text-rose-300">✕</button></span>
                </div>
              ))}
              <button onClick={() => setNewScreen({ theatreId: t.id, name: 'Audi', template: 'multiplex', formats: ['2D'] })} className="w-full rounded-xl border border-dashed border-white/15 py-2 text-xs text-white/50 hover:border-white/30 hover:text-white">+ Add screen</button>
            </div>
          </div>
        ))}
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} label="Edit theatre" className="sm:!max-w-2xl">
        {edit && <TheatreForm t={edit} onSave={async (v) => { if (await th.save(edit.id ?? null, v)) setEdit(null); }} />}
      </Modal>
      <Modal open={!!newScreen} onClose={() => setNewScreen(null)} label="Add screen">
        {newScreen && (
          <div className="space-y-4">
            <h2 className="font-display text-xl font-bold">Add screen</h2>
            <Field label="Name"><input className="input" value={newScreen.name} onChange={(e) => setNewScreen({ ...newScreen, name: e.target.value })} /></Field>
            <Field label="Start from template"><select className="input" value={newScreen.template} onChange={(e) => setNewScreen({ ...newScreen, template: e.target.value as 'imax' })}><option value="multiplex">Multiplex (12 rows)</option><option value="imax">IMAX (14 rows)</option><option value="lux">Luxury recliner (6 rows)</option></select></Field>
            <Field label="Formats (comma separated)"><input className="input" value={newScreen.formats.join(', ')} onChange={(e) => setNewScreen({ ...newScreen, formats: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} /></Field>
            <Button onClick={async () => { if (await sc.save(null, newScreen)) setNewScreen(null); }}>Create screen</Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

function TheatreForm({ t, onSave }: { t: Partial<Theatre>; onSave: (v: unknown) => void }) {
  const [f, setF] = useState({ ...t, facilitiesS: t.facilities?.join(', ') ?? '' });
  const set = (k: string, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  const useCity = (id: string) => { const c = CITIES.find((x) => x.id === id)!; setF((x) => ({ ...x, cityId: id, lat: c.lat, lng: c.lng })); };
  return (
    <div>
      <h2 className="font-display text-xl font-bold">{t.id ? 'Edit theatre' : 'New theatre'}</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Field label="Name" className="sm:col-span-2"><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Brand"><input className="input" value={f.brand} onChange={(e) => set('brand', e.target.value)} /></Field>
        <Field label="City"><select className="input" value={f.cityId} onChange={(e) => useCity(e.target.value)}>{CITIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Area"><input className="input" value={f.area} onChange={(e) => set('area', e.target.value)} /></Field>
        <Field label="Rating (0–5)"><input type="number" step="0.1" className="input" value={f.rating} onChange={(e) => set('rating', +e.target.value)} /></Field>
        <Field label="Address" className="sm:col-span-2"><input className="input" value={f.address} onChange={(e) => set('address', e.target.value)} /></Field>
        <Field label="Latitude"><input type="number" step="0.0001" className="input" value={f.lat} onChange={(e) => set('lat', +e.target.value)} /></Field>
        <Field label="Longitude"><input type="number" step="0.0001" className="input" value={f.lng} onChange={(e) => set('lng', +e.target.value)} /></Field>
        <Field label="Facilities (comma separated)" className="sm:col-span-2"><input className="input" value={f.facilitiesS} onChange={(e) => set('facilitiesS', e.target.value)} /></Field>
        <Field label="Cancellation window (hours before show)"><input type="number" className="input" value={f.cancellationHours} onChange={(e) => set('cancellationHours', +e.target.value)} /></Field>
      </div>
      <div className="mt-6 flex justify-end"><Button onClick={() => { const { facilitiesS, id: _i, ...rest } = f as typeof f & { id?: string }; onSave({ ...rest, facilities: facilitiesS.split(',').map((x) => x.trim()).filter(Boolean) }); }}>Save theatre</Button></div>
    </div>
  );
}
