'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { AnimatePresence } from 'framer-motion';
import { useMemo, useState } from 'react';
import type { LayoutRow, Panorama, Screen, SeatLayout } from '@/lib/types';
import { computeSeats, makeRow, rowLabel, validateLayout, viewMetrics } from '@/lib/geometry';
import { api } from '@/lib/client';
import { toast } from '@/lib/store';
import { SeatMap } from '../booking/SeatMap';
import { Button } from '../ui/Button';
import { Field, PageHead } from './ui';
import { useAdmin, upload } from './useAdmin';

const ImmersiveView = dynamic(() => import('../immersive/ImmersiveView'), { ssr: false });

/** Compact, editable description of a row; converted to/from cells. */
interface RowSpec { label: string; categoryId: string; seats: number; aisles: string; accessible: string; walkwayAfter: boolean }
const toSpec = (r: LayoutRow): RowSpec => {
  const seats = r.cells.filter((c) => c.t === 's') as { t: 's'; n: number; acc?: boolean }[];
  const aisles: number[] = [];
  r.cells.forEach((c, i) => { if (c.t === 'g' && i > 0 && r.cells[i - 1].t === 's') aisles.push((r.cells[i - 1] as { n: number }).n); });
  return { label: r.label, categoryId: r.categoryId, seats: seats.length, aisles: aisles.join(', '), accessible: seats.filter((s) => s.acc).map((s) => s.n).join(', '), walkwayAfter: !!r.walkwayAfter };
};
const nums = (s: string) => s.split(',').map((x) => parseInt(x.trim(), 10)).filter((n) => n > 0);
const fromSpec = (s: RowSpec): LayoutRow => makeRow(s.label, s.categoryId, Math.max(1, Math.min(50, s.seats)), nums(s.aisles), { accessible: nums(s.accessible), walkwayAfter: s.walkwayAfter });

export function LayoutEditor({ screen, theatreName }: { screen: Screen; theatreName: string }) {
  const [specs, setSpecs] = useState<RowSpec[]>(screen.layout.rows.map(toSpec));
  const [cats, setCats] = useState(screen.layout.categories);
  const [geo, setGeo] = useState(screen.layout.geometry);
  const [exits, setExits] = useState(screen.layout.exits);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [gen, setGen] = useState({ rows: 10, seats: 16, aisles: '4, 12' });
  const panos = useAdmin<Panorama>('panoramas', `screenId=${screen.id}`);

  const layout: SeatLayout = useMemo(() => ({ rows: specs.map(fromSpec), categories: cats, geometry: geo, exits }), [specs, cats, geo, exits]);
  const errors = useMemo(() => validateLayout(layout), [layout]);
  const seats = useMemo(() => computeSeats(layout), [layout]);
  const best = useMemo(() => seats.reduce((a, s) => { const m = viewMetrics(s, geo); return m.score > a.score ? { id: s.id, score: m.score } : a; }, { id: '', score: -1 }), [seats, geo]);

  const setRow = (i: number, p: Partial<RowSpec>) => setSpecs((r) => r.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const generate = () => {
    const ids = cats.map((c) => c.id);
    setSpecs(Array.from({ length: gen.rows }, (_, i) => ({ label: rowLabel(i), categoryId: ids[Math.min(ids.length - 1, Math.floor((i / gen.rows) * Math.min(ids.length, 3)))], seats: gen.seats, aisles: gen.aisles, accessible: i === 0 ? `1, ${gen.seats}` : '', walkwayAfter: false })));
  };
  const save = async () => {
    if (errors.length) return toast('error', errors[0]);
    setSaving(true);
    try { await api(`/api/admin/screens/${screen.id}`, { method: 'PUT', json: { layout } }); toast('success', 'Layout saved. New shows use it immediately.'); }
    catch (e) { toast('error', (e as Error).message); } finally { setSaving(false); }
  };

  return (
    <div>
      <Link href="/admin/theatres" className="text-xs text-white/50 hover:text-white">← Theatres</Link>
      <PageHead title={`${screen.name} layout`} sub={`${theatreName} · ${seats.length} seats · best seat ${best.id} (${best.score}/100)`}>
        <Button onClick={save} loading={saving} disabled={!!errors.length}>Save layout</Button>
      </PageHead>
      {errors.length > 0 && <div className="mb-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100">{errors.slice(0, 4).map((e) => <p key={e}>• {e}</p>)}</div>}

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="space-y-6">
          <section className="glass rounded-2xl p-5">
            <h2 className="font-semibold">Screen & hall geometry</h2>
            <p className="mt-1 text-xs text-white/45">These values drive the seat map, viewing scores, recommendations and the simulated 180° preview.</p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {([['screenWidthM', 'Screen width (m)', 0.5], ['screenHeightM', 'Screen height (m)', 0.1], ['screenElevationM', 'Screen bottom height (m)', 0.1], ['firstRowDistanceM', 'Screen → first row (m)', 0.1], ['rowSpacingM', 'Row spacing (m)', 0.05], ['seatWidthM', 'Seat width (m)', 0.01], ['rakeM', 'Riser per row (m)', 0.02], ['curvature', 'Row curvature', 0.001], ['walkwayDepthM', 'Walkway depth (m)', 0.1]] as const).map(([k, l, step]) => (
                <Field key={k} label={l}><input type="number" step={step} className="input !py-2" value={geo[k]} onChange={(e) => setGeo({ ...geo, [k]: +e.target.value })} /></Field>
              ))}
            </div>
          </section>

          <section className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between"><h2 className="font-semibold">Seat categories & pricing</h2>
              <button className="chip" onClick={() => setCats([...cats, { id: `c${cats.length + 1}x`, name: 'New tier', kind: 'standard', price: 200 }])}>+ Category</button></div>
            <div className="mt-3 space-y-2">
              {cats.map((c, i) => (
                <div key={i} className="grid grid-cols-[80px_1fr_120px_100px_32px] items-center gap-2">
                  <input className="input !py-2 text-xs" value={c.id} onChange={(e) => setCats(cats.map((x, j) => (j === i ? { ...x, id: e.target.value.toLowerCase() } : x)))} aria-label="Category id" />
                  <input className="input !py-2" value={c.name} onChange={(e) => setCats(cats.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} aria-label="Name" />
                  <select className="input !py-2" value={c.kind} onChange={(e) => setCats(cats.map((x, j) => (j === i ? { ...x, kind: e.target.value as typeof c.kind } : x)))} aria-label="Kind">{['standard', 'premium', 'recliner', 'vip'].map((k) => <option key={k}>{k}</option>)}</select>
                  <input type="number" className="input !py-2" value={c.price} onChange={(e) => setCats(cats.map((x, j) => (j === i ? { ...x, price: +e.target.value } : x)))} aria-label="Base price ₹" />
                  <button className="text-white/40 hover:text-rose-300" onClick={() => setCats(cats.filter((_, j) => j !== i))} aria-label="Remove category">✕</button>
                </div>
              ))}
            </div>
          </section>

          <section className="glass rounded-2xl p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="font-semibold">Rows</h2>
              <div className="flex flex-wrap items-end gap-2 text-xs">
                <Field label="Rows"><input type="number" className="input !w-16 !py-1.5" value={gen.rows} onChange={(e) => setGen({ ...gen, rows: +e.target.value })} /></Field>
                <Field label="Seats/row"><input type="number" className="input !w-16 !py-1.5" value={gen.seats} onChange={(e) => setGen({ ...gen, seats: +e.target.value })} /></Field>
                <Field label="Aisle after"><input className="input !w-24 !py-1.5" value={gen.aisles} onChange={(e) => setGen({ ...gen, aisles: e.target.value })} /></Field>
                <button className="chip h-9" onClick={generate}>Generate</button>
              </div>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-xs">
                <thead className="text-left text-white/40"><tr><th className="py-1">Row</th><th>Category</th><th>Seats</th><th>Aisle after seat #</th><th>Accessible #</th><th>Walkway</th><th /></tr></thead>
                <tbody>
                  {specs.map((r, i) => (
                    <tr key={i}>
                      <td className="py-1 pr-1"><input className="input !w-14 !px-2 !py-1.5" value={r.label} onChange={(e) => setRow(i, { label: e.target.value.toUpperCase() })} aria-label="Row label" /></td>
                      <td className="pr-1"><select className="input !py-1.5" value={r.categoryId} onChange={(e) => setRow(i, { categoryId: e.target.value })} aria-label="Category">{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></td>
                      <td className="pr-1"><input type="number" className="input !w-16 !py-1.5" value={r.seats} onChange={(e) => setRow(i, { seats: +e.target.value })} aria-label="Seats" /></td>
                      <td className="pr-1"><input className="input !py-1.5" value={r.aisles} onChange={(e) => setRow(i, { aisles: e.target.value })} aria-label="Aisles after" /></td>
                      <td className="pr-1"><input className="input !py-1.5" value={r.accessible} onChange={(e) => setRow(i, { accessible: e.target.value })} aria-label="Accessible seats" /></td>
                      <td className="text-center"><input type="checkbox" checked={r.walkwayAfter} onChange={(e) => setRow(i, { walkwayAfter: e.target.checked })} aria-label="Walkway after row" className="accent-violet-500" /></td>
                      <td><button className="px-2 text-white/40 hover:text-rose-300" onClick={() => setSpecs(specs.filter((_, j) => j !== i))} aria-label="Remove row">✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="mt-2 w-full rounded-xl border border-dashed border-white/15 py-2 text-xs text-white/50 hover:text-white" onClick={() => { const last = specs[specs.length - 1]; setSpecs([...specs, { ...(last ?? { categoryId: cats[0]?.id, seats: 14, aisles: '', accessible: '', walkwayAfter: false }), label: rowLabel(specs.length), walkwayAfter: false } as RowSpec]); }}>+ Add row at rear</button>
          </section>

          <section className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between"><h2 className="font-semibold">Exits</h2><button className="chip" onClick={() => setExits([...exits, { side: 'left', rowIndex: 0 }])}>+ Exit</button></div>
            <div className="mt-3 flex flex-wrap gap-2">
              {exits.map((e, i) => (
                <div key={i} className="flex items-center gap-1 rounded-xl bg-white/[0.03] p-1.5">
                  <select className="input !w-24 !py-1 text-xs" value={e.side} onChange={(ev) => setExits(exits.map((x, j) => (j === i ? { ...x, side: ev.target.value as typeof e.side } : x)))}>{['left', 'right', 'rear'].map((s) => <option key={s}>{s}</option>)}</select>
                  <select className="input !w-20 !py-1 text-xs" value={e.rowIndex} onChange={(ev) => setExits(exits.map((x, j) => (j === i ? { ...x, rowIndex: +ev.target.value } : x)))}>{specs.map((r, j) => <option key={j} value={j}>Row {r.label}</option>)}</select>
                  <button className="px-1 text-white/40" onClick={() => setExits(exits.filter((_, j) => j !== i))} aria-label="Remove exit">✕</button>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <section className="glass overflow-hidden rounded-2xl">
            <p className="px-5 pt-4 text-xs text-white/50">Live preview: click a seat to open its simulated 180° view</p>
            <SeatMap layout={layout} states={{}} selected={[]} highlight={best.id ? [best.id] : []} onSeat={(s) => setPreview(s.id)} className="h-[56vh] w-full" />
          </section>
          <PanoramaManager screen={screen} layout={layout} panos={panos} />
        </div>
      </div>

      <AnimatePresence>
        {preview && <ImmersiveView key="pv" layout={layout} show={{ priceFactor: 1 }} movie={{ title: 'Calibration', tagline: 'Simulated preview', palette: ['#0b1d4f', '#4f8cff', '#b04cff'] }} states={{}} selected={[]} seatId={preview} panoramas={panos.items ?? []} origin={{ x: innerWidth / 2, y: innerHeight / 2 }} onSeatChange={setPreview} onSelect={() => setPreview(null)} onClose={() => setPreview(null)} />}
      </AnimatePresence>
    </div>
  );
}

function PanoramaManager({ screen, layout, panos }: { screen: Screen; layout: SeatLayout; panos: ReturnType<typeof useAdmin<Panorama>> }) {
  const [f, setF] = useState({ url: '', projection: '180' as '180' | '360', rows: '', side: 'any' as Panorama['zone']['side'], yawOffsetDeg: 0, capturedAt: new Date().toISOString().slice(0, 10), label: '' });
  const [busy, setBusy] = useState(false);
  const add = async () => {
    const ok = await panos.save(null, { screenId: screen.id, url: f.url, projection: f.projection, zone: { rows: f.rows.split(',').map((x) => x.trim().toUpperCase()).filter(Boolean), side: f.side }, yawOffsetDeg: f.yawOffsetDeg, capturedAt: f.capturedAt, label: f.label || `Row ${f.rows || 'any'} ${f.side}` });
    if (ok) setF({ ...f, url: '', label: '' });
  };
  return (
    <section className="glass rounded-2xl p-5">
      <h2 className="font-semibold">Real theatre panoramas</h2>
      <p className="mt-1 text-xs text-white/45">Upload real 180° or 360° equirectangular photographs and map them to a seat zone. Seats in a matching zone show “Real photograph”; every other seat falls back to the labelled simulation.</p>
      <ul className="mt-3 space-y-2">
        {(panos.items ?? []).map((p) => (
          <li key={p.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-2 text-xs">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" className="h-10 w-20 rounded object-cover" />
            <span className="flex-1"><b>{p.label}</b><br /><span className="text-white/45">{p.projection}° · rows {p.zone.rows.join(', ') || 'any'} · {p.zone.side} · yaw {p.yawOffsetDeg}°</span></span>
            <button className="chip text-rose-300" onClick={() => panos.remove(p.id)}>Delete</button>
          </li>
        ))}
      </ul>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Photograph (JPEG/PNG/WebP)" className="sm:col-span-2"><input type="file" accept="image/jpeg,image/png,image/webp" className="input !py-2 text-xs" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; setBusy(true); const u = await upload(file); setBusy(false); if (u) setF({ ...f, url: u }); }} />{busy && <span className="text-xs text-white/50">Uploading…</span>}{f.url && <span className="text-xs text-emerald-300">Uploaded ✓</span>}</Field>
        <Field label="Projection"><select className="input !py-2" value={f.projection} onChange={(e) => setF({ ...f, projection: e.target.value as '180' })}><option value="180">180° (half equirectangular)</option><option value="360">360° equirectangular</option></select></Field>
        <Field label="Seat side"><select className="input !py-2" value={f.side} onChange={(e) => setF({ ...f, side: e.target.value as 'any' })}>{['any', 'left', 'centre', 'right'].map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label={`Rows (comma separated; ${layout.rows.map((r) => r.label).join('')})`}><input className="input !py-2" value={f.rows} onChange={(e) => setF({ ...f, rows: e.target.value })} placeholder="e.g. G, H, J" /></Field>
        <Field label="Yaw offset to screen (°)"><input type="number" className="input !py-2" value={f.yawOffsetDeg} onChange={(e) => setF({ ...f, yawOffsetDeg: +e.target.value })} /></Field>
        <Field label="Captured on"><input type="date" className="input !py-2" value={f.capturedAt} onChange={(e) => setF({ ...f, capturedAt: e.target.value })} /></Field>
        <Field label="Label"><input className="input !py-2" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="Row H centre" /></Field>
      </div>
      <div className="mt-4"><Button onClick={add} disabled={!f.url}>Attach panorama</Button></div>
    </section>
  );
}
