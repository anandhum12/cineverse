'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PREFERENCES, type Preference, type Recommendation } from '@/lib/recommend';
import { api } from '@/lib/client';
import { cx, inr } from '@/lib/format';
import { toast } from '@/lib/store';

export function Recommender({ showId, onHighlight, onApply, onPreview }: { showId: string; onHighlight: (ids: string[]) => void; onApply: (ids: string[]) => void; onPreview: (id: string) => void }) {
  const [pref, setPref] = useState<Preference>('best');
  const [party, setParty] = useState(2);
  const [recs, setRecs] = useState<Recommendation[] | null>(null);
  const [loading, setLoading] = useState(false);
  const find = async () => {
    setLoading(true);
    try {
      const r = await api<{ recommendations: Recommendation[] }>(`/api/shows/${showId}/recommend?pref=${pref}&party=${party}`);
      setRecs(r.recommendations);
      onHighlight(r.recommendations[0]?.seatIds ?? []);
      if (!r.recommendations.length) toast('info', 'No seats match that preference. Try another option or fewer seats.');
    } catch (e) { toast('error', (e as Error).message); } finally { setLoading(false); }
  };
  return (
    <div className="glass rounded-3xl p-5">
      <div className="flex items-center justify-between"><h3 className="font-display text-lg font-semibold">Find my best seat</h3><span className="text-[10px] uppercase tracking-widest text-white/35">Geometry-based</span></div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {PREFERENCES.map((p) => <button key={p.id} title={p.hint} onClick={() => { setPref(p.id); setRecs(null); onHighlight([]); }} className={cx('chip focus-ring', pref === p.id && 'border-neon-violet bg-neon-violet/20 text-white')}>{p.label}</button>)}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <span className="text-xs text-white/55">Seats</span>
        <div className="flex items-center rounded-full border border-white/10">
          <button aria-label="Fewer seats" onClick={() => setParty((p) => Math.max(1, p - 1))} className="h-8 w-8 rounded-full text-white/70 hover:text-white">−</button>
          <span className="w-6 text-center text-sm font-semibold tabular-nums">{party}</span>
          <button aria-label="More seats" onClick={() => setParty((p) => Math.min(10, p + 1))} className="h-8 w-8 rounded-full text-white/70 hover:text-white">+</button>
        </div>
        <button onClick={find} disabled={loading} className="ml-auto h-9 rounded-full bg-white px-4 text-xs font-bold text-ink-950 transition hover:bg-neon-violet hover:text-white disabled:opacity-50 focus-ring">{loading ? 'Finding…' : 'Find seats'}</button>
      </div>
      <AnimatePresence>
        {recs && recs.length > 0 && (
          <motion.ul initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-4 space-y-2 overflow-hidden">
            {recs.map((r, i) => (
              <li key={r.seatIds.join()} onMouseEnter={() => onHighlight(r.seatIds)} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition hover:border-neon-cyan/50">
                <div className="flex items-center justify-between gap-2">
                  <div><p className="text-sm font-semibold">{i === 0 && <span className="mr-1.5 rounded-full bg-neon-cyan/15 px-1.5 py-0.5 text-[10px] text-neon-cyan">Top pick</span>}{r.seatIds.join(', ')}</p><p className="mt-0.5 text-xs text-white/50">{r.reason} · {inr(r.pricePerSeat)} each</p></div>
                  <div className="flex shrink-0 gap-1.5">
                    <button onClick={() => onPreview(r.seatIds[Math.floor(r.seatIds.length / 2)])} className="chip h-8 focus-ring" aria-label={`Preview view from ${r.seatIds.join(', ')}`}>180°</button>
                    <button onClick={() => onApply(r.seatIds)} className="h-8 rounded-full bg-neon-gradient px-3 text-xs font-bold focus-ring">Select</button>
                  </div>
                </div>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
