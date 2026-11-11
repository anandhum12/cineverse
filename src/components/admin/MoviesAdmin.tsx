'use client';
import { useState } from 'react';
import type { Movie } from '@/lib/types';
import { useAdmin, upload } from './useAdmin';
import { Field, PageHead, Table } from './ui';
import { Modal, Skeleton } from '../ui/misc';
import { Button } from '../ui/Button';
import { Poster } from '../Poster';
import { fmtDate } from '@/lib/format';

const FORMATS = ['2D', '3D', 'IMAX', 'IMAX 3D', 'Dolby Atmos', '4DX'] as const;
const MOTIFS = ['orb', 'rings', 'waves', 'grid', 'monolith', 'rain', 'sun'] as const;
const blank = (): Partial<Movie> => ({ title: '', tagline: '', synopsis: '', genres: ['Drama'], durationMin: 120, languages: ['English'], certification: 'UA', rating: 0, votes: 0, releaseDate: new Date().toISOString().slice(0, 10), status: 'soon', formats: ['2D'], director: '', cast: [], crew: [], palette: ['#0b1d4f', '#4f8cff', '#b04cff'], motif: 'orb', trending: 50, posterUrl: null, backdropUrl: null, trailerUrl: null });

export function MoviesAdmin() {
  const { items, save, remove } = useAdmin<Movie>('movies');
  const [edit, setEdit] = useState<Partial<Movie> | null>(null);
  return (
    <div>
      <PageHead title="Movies" sub="Catalogue, artwork and trailers"><Button onClick={() => setEdit(blank())}>Add movie</Button></PageHead>
      {!items ? <Skeleton className="h-96" /> : (
        <Table head={['', 'Title', 'Status', 'Release', 'Languages', 'Rating', '']}>
          {items.map((m) => (
            <tr key={m.id} className="hover:bg-white/[0.02]">
              <td className="px-4 py-2"><div className="h-14 w-10 overflow-hidden rounded-md"><Poster movie={m} showTitle={false} /></div></td>
              <td className="px-4 py-2"><p className="font-semibold">{m.title}</p><p className="text-xs text-white/40">{m.genres.join(', ')}</p></td>
              <td className="px-4 py-2"><span className="chip">{m.status === 'now' ? 'Now showing' : 'Coming soon'}</span></td>
              <td className="px-4 py-2 text-white/60">{fmtDate(m.releaseDate)}</td>
              <td className="px-4 py-2 text-white/60">{m.languages.join(', ')}</td>
              <td className="px-4 py-2 text-white/60">{m.rating || '—'}</td>
              <td className="px-4 py-2 text-right"><button onClick={() => setEdit(m)} className="chip">Edit</button> <button onClick={() => remove(m.id)} className="chip text-rose-300">Delete</button></td>
            </tr>
          ))}
        </Table>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} label="Edit movie" className="sm:!max-w-3xl">
        {edit && <MovieForm m={edit} onCancel={() => setEdit(null)} onSave={async (v) => { if (await save(edit.id ?? null, v)) setEdit(null); }} />}
      </Modal>
    </div>
  );
}

const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
const people = (s: string) => s.split('\n').map((l) => l.split('—').map((x) => x.trim())).filter((p) => p[0]).map(([name, role = '']) => ({ name, role }));

function MovieForm({ m, onSave, onCancel }: { m: Partial<Movie>; onSave: (v: unknown) => void; onCancel: () => void }) {
  const [f, setF] = useState({ ...m, genresS: m.genres?.join(', ') ?? '', languagesS: m.languages?.join(', ') ?? '', castS: m.cast?.map((c) => `${c.name} — ${c.role}`).join('\n') ?? '', crewS: m.crew?.map((c) => `${c.name} — ${c.role}`).join('\n') ?? '' });
  const [busy, setBusy] = useState<string | null>(null);
  const set = (k: string, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  const up = async (k: 'posterUrl' | 'backdropUrl' | 'trailerUrl', file?: File) => { if (!file) return; setBusy(k); const u = await upload(file); setBusy(null); if (u) set(k, u); };
  const submit = () => {
    const { genresS, languagesS, castS, crewS, id: _id, slug: _s, createdAt: _c, ...rest } = f as typeof f & { id?: string; slug?: string; createdAt?: string };
    onSave({ ...rest, genres: list(genresS), languages: list(languagesS), cast: people(castS), crew: people(crewS), posterUrl: rest.posterUrl || null, backdropUrl: rest.backdropUrl || null, trailerUrl: rest.trailerUrl || null });
  };
  return (
    <div>
      <h2 className="font-display text-xl font-bold">{m.id ? 'Edit movie' : 'New movie'}</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-[160px_1fr]">
        <div className="space-y-2">
          <div className="aspect-[2/3] overflow-hidden rounded-xl ring-1 ring-white/10"><Poster movie={{ id: f.id ?? 'new', title: f.title || 'Untitled', palette: f.palette as Movie['palette'], motif: f.motif as Movie['motif'], posterUrl: f.posterUrl, backdropUrl: f.backdropUrl, tagline: f.tagline ?? '' }} /></div>
          <p className="text-[10px] text-white/40">Without uploaded artwork, a poster is generated from the palette &amp; motif.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Title" className="sm:col-span-2"><input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} /></Field>
          <Field label="Tagline" className="sm:col-span-2"><input className="input" value={f.tagline} onChange={(e) => set('tagline', e.target.value)} /></Field>
          <Field label="Synopsis" className="sm:col-span-2"><textarea className="input min-h-[90px]" value={f.synopsis} onChange={(e) => set('synopsis', e.target.value)} /></Field>
          <Field label="Genres (comma separated)"><input className="input" value={f.genresS} onChange={(e) => set('genresS', e.target.value)} /></Field>
          <Field label="Languages (comma separated)"><input className="input" value={f.languagesS} onChange={(e) => set('languagesS', e.target.value)} /></Field>
          <Field label="Duration (min)"><input type="number" className="input" value={f.durationMin} onChange={(e) => set('durationMin', +e.target.value)} /></Field>
          <Field label="Certification"><select className="input" value={f.certification} onChange={(e) => set('certification', e.target.value)}>{['U', 'UA', 'UA13+', 'UA16+', 'A', 'S'].map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Release date"><input type="date" className="input" value={f.releaseDate} onChange={(e) => set('releaseDate', e.target.value)} /></Field>
          <Field label="Status"><select className="input" value={f.status} onChange={(e) => set('status', e.target.value)}><option value="now">Now showing</option><option value="soon">Coming soon</option></select></Field>
          <Field label="Verified rating (0–10)"><input type="number" step="0.1" className="input" value={f.rating} onChange={(e) => set('rating', +e.target.value)} /></Field>
          <Field label="Rating source"><input className="input" value={f.ratingSource ?? 'CineVerse verified audience'} onChange={(e) => set('ratingSource', e.target.value)} /></Field>
          <Field label="Director"><input className="input" value={f.director} onChange={(e) => set('director', e.target.value)} /></Field>
          <Field label="Trending (0–100)"><input type="number" className="input" value={f.trending} onChange={(e) => set('trending', +e.target.value)} /></Field>
          <div className="sm:col-span-2"><span className="label">Formats</span><div className="flex flex-wrap gap-1.5">{FORMATS.map((x) => <button key={x} type="button" onClick={() => set('formats', f.formats?.includes(x) ? f.formats.filter((y) => y !== x) : [...(f.formats ?? []), x])} className={`chip ${f.formats?.includes(x) ? 'border-neon-violet bg-neon-violet/20 text-white' : ''}`}>{x}</button>)}</div></div>
          <Field label="Cast (one per line: Name — Role)"><textarea className="input min-h-[80px]" value={f.castS} onChange={(e) => set('castS', e.target.value)} /></Field>
          <Field label="Crew (one per line: Name — Job)"><textarea className="input min-h-[80px]" value={f.crewS} onChange={(e) => set('crewS', e.target.value)} /></Field>
          <div className="sm:col-span-2 grid grid-cols-3 gap-2">{[0, 1, 2].map((i) => <Field key={i} label={`Palette ${i + 1}`}><input type="color" className="h-10 w-full rounded-lg bg-transparent" value={f.palette?.[i]} onChange={(e) => { const p = [...(f.palette ?? [])] as Movie['palette']; p[i] = e.target.value; set('palette', p); }} /></Field>)}</div>
          <Field label="Generated art motif"><select className="input" value={f.motif} onChange={(e) => set('motif', e.target.value)}>{MOTIFS.map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Trailer URL (YouTube / https MP4)"><input className="input" value={f.trailerUrl ?? ''} onChange={(e) => set('trailerUrl', e.target.value)} placeholder="https://youtu.be/…" /></Field>
          {(['posterUrl', 'backdropUrl'] as const).map((k) => (
            <Field key={k} label={k === 'posterUrl' ? 'Poster (2:3)' : 'Backdrop (16:9)'}>
              <div className="flex gap-2"><input type="file" accept="image/jpeg,image/png,image/webp" className="input !py-2 text-xs" onChange={(e) => up(k, e.target.files?.[0])} />{f[k] && <button type="button" className="chip" onClick={() => set(k, null)}>Clear</button>}</div>
              {busy === k && <span className="text-xs text-white/50">Uploading…</span>}
            </Field>
          ))}
          <Field label="Trailer file (MP4, optional)"><input type="file" accept="video/mp4" className="input !py-2 text-xs" onChange={(e) => up('trailerUrl', e.target.files?.[0])} /></Field>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2"><Button variant="ghost" onClick={onCancel}>Cancel</Button><Button onClick={submit}>Save movie</Button></div>
    </div>
  );
}
