'use client';
import { useMemo, useState } from 'react';
import type { Movie, Screen, Show, Theatre } from '@/lib/types';
import { useAdmin } from './useAdmin';
import { Field, PageHead, Table } from './ui';
import { Modal, Skeleton } from '../ui/misc';
import { Button } from '../ui/Button';
import { fmtDate, fmtTime, istDay } from '@/lib/format';

type AdminShow = Omit<Show, 'soldOffline'> & { soldOffline: number };

export function ShowsAdmin() {
  const th = useAdmin<Theatre>('theatres');
  const sc = useAdmin<Screen>('screens');
  const mv = useAdmin<Movie>('movies');
  const [theatre, setTheatre] = useState('th_kochi_0');
  const shows = useAdmin<AdminShow>('shows', `theatreId=${theatre}`);
  const [form, setForm] = useState<null | { movieId: string; screenId: string; date: string; time: string; language: string; format: string; priceFactor: number }>(null);
  const screens = useMemo(() => (sc.items ?? []).filter((s) => s.theatreId === theatre), [sc.items, theatre]);
  const movie = (id: string) => mv.items?.find((m) => m.id === id);
  const screen = (id: string) => sc.items?.find((s) => s.id === id);
  if (!th.items || !sc.items || !mv.items) return <Skeleton className="h-96" />;
  const openNew = () => { const m = mv.items!.find((x) => x.status === 'now') ?? mv.items![0]; setForm({ movieId: m.id, screenId: screens[0]?.id ?? '', date: istDay(new Date()), time: '18:30', language: m.languages[0], format: m.formats[0], priceFactor: 1 }); };
  const fm = form && movie(form.movieId);
  return (
    <div>
      <PageHead title="Showtimes" sub="Schedule shows per screen. Overlapping shows on the same screen are rejected.">
        <select className="input !w-auto !py-2" value={theatre} onChange={(e) => setTheatre(e.target.value)} aria-label="Theatre">{th.items.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        <Button onClick={openNew} disabled={!screens.length}>Add show</Button>
      </PageHead>
      {!shows.items ? <Skeleton className="h-96" /> : (
        <Table head={['When', 'Movie', 'Screen', 'Format', 'Price ×', 'Box office', 'Status', '']}>
          {shows.items.map((s) => (
            <tr key={s.id} className={s.cancelled ? 'opacity-50' : ''}>
              <td className="px-4 py-2 whitespace-nowrap">{fmtDate(s.startsAt)} · {fmtTime(s.startsAt)}</td>
              <td className="px-4 py-2">{movie(s.movieId)?.title}</td>
              <td className="px-4 py-2 text-white/60">{screen(s.screenId)?.name}</td>
              <td className="px-4 py-2 text-white/60">{s.format} · {s.language}</td>
              <td className="px-4 py-2 text-white/60">{s.priceFactor.toFixed(2)}</td>
              <td className="px-4 py-2 text-white/60">{s.soldOffline} sold</td>
              <td className="px-4 py-2">{s.cancelled ? <span className="chip text-rose-300">Cancelled</span> : <span className="chip">Scheduled</span>}</td>
              <td className="px-4 py-2 text-right whitespace-nowrap">
                <button className="chip" onClick={() => shows.save(s.id, { cancelled: !s.cancelled })}>{s.cancelled ? 'Restore' : 'Cancel'}</button>{' '}
                <button className="chip text-rose-300" onClick={() => shows.remove(s.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </Table>
      )}
      <Modal open={!!form} onClose={() => setForm(null)} label="Add show">
        {form && fm && (
          <div className="space-y-3">
            <h2 className="font-display text-xl font-bold">Add show</h2>
            <Field label="Movie"><select className="input" value={form.movieId} onChange={(e) => { const m = movie(e.target.value)!; setForm({ ...form, movieId: m.id, language: m.languages[0], format: m.formats[0] }); }}>{mv.items!.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}</select></Field>
            <Field label="Screen"><select className="input" value={form.screenId} onChange={(e) => setForm({ ...form, screenId: e.target.value })}>{screens.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.formats.join(', ')})</option>)}</select></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date"><input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
              <Field label="Time (IST)"><input type="time" className="input" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></Field>
              <Field label="Language"><select className="input" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>{fm.languages.map((l) => <option key={l}>{l}</option>)}</select></Field>
              <Field label="Format"><select className="input" value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })}>{fm.formats.map((l) => <option key={l}>{l}</option>)}</select></Field>
              <Field label="Price multiplier"><input type="number" step="0.05" className="input" value={form.priceFactor} onChange={(e) => setForm({ ...form, priceFactor: +e.target.value })} /></Field>
            </div>
            <Button onClick={async () => { if (await shows.save(null, { movieId: form.movieId, screenId: form.screenId, startsAt: `${form.date}T${form.time}:00+05:30`, language: form.language, format: form.format, priceFactor: form.priceFactor })) setForm(null); }}>Create show</Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
