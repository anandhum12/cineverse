'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { fmtDate, inr } from '@/lib/format';
import { Skeleton } from '../ui/misc';
import { PageHead } from './ui';

interface Stats { gross: number; refunds: number; net: number; bookings: number; tickets: number; users: number; movies: number; theatres: number; screens: number; upcomingShows: number; failedPayments: number; byDay: { day: string; revenue: number; tickets: number }[]; topMovies: { title: string; revenue: number; tickets: number }[] }

export function AdminOverview() {
  const [s, setS] = useState<Stats | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  useEffect(() => { api<Stats>('/api/admin/stats').then(setS).catch(() => {}); }, []);
  if (!s) return <div className="grid gap-4 sm:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-28" />)}</div>;
  const max = Math.max(1, ...s.byDay.map((d) => d.revenue));
  const tiles = [
    { k: 'Net revenue', v: inr(s.net), sub: `${inr(s.gross)} gross · ${inr(s.refunds)} refunded` },
    { k: 'Confirmed bookings', v: s.bookings.toLocaleString('en-IN'), sub: `${s.tickets} tickets sold online` },
    { k: 'Upcoming shows', v: s.upcomingShows.toLocaleString('en-IN'), sub: `${s.theatres} theatres · ${s.screens} screens` },
    { k: 'Users', v: s.users.toLocaleString('en-IN'), sub: `${s.failedPayments} failed payment attempts` },
  ];
  return (
    <div>
      <PageHead title="Overview" sub="Online sales across all CineVerse cinemas" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((t) => <div key={t.k} className="glass rounded-2xl p-5"><p className="text-xs text-white/50">{t.k}</p><p className="mt-2 font-display text-3xl font-bold text-white">{t.v}</p><p className="mt-1 text-xs text-white/40">{t.sub}</p></div>)}
      </div>
      <div className="mt-6 grid gap-4 xl:grid-cols-[2fr_1fr]">
        <section className="glass rounded-2xl p-5" aria-labelledby="rev-h">
          <div className="flex items-center justify-between"><h2 id="rev-h" className="font-semibold">Revenue, last 14 days</h2><button onClick={() => setTable((t) => !t)} className="chip">{table ? 'Chart' : 'Table'}</button></div>
          {table ? (
            <table className="mt-4 w-full text-sm"><thead><tr className="text-left text-xs text-white/40"><th className="py-1">Day</th><th>Tickets</th><th className="text-right">Revenue</th></tr></thead>
              <tbody>{s.byDay.map((d) => <tr key={d.day} className="border-t border-white/[0.05]"><td className="py-1.5 text-white/70">{fmtDate(d.day + 'T12:00:00+05:30')}</td><td className="text-white/70">{d.tickets}</td><td className="text-right tabular-nums text-white">{inr(d.revenue)}</td></tr>)}</tbody></table>
          ) : (
            <div className="relative mt-6">
              <div className="flex h-56 items-end gap-[2px] border-b border-white/10" onMouseLeave={() => setHover(null)} role="img" aria-label="Daily revenue bar chart; use the Table button for values">
                {s.byDay.map((d, i) => (
                  <div key={d.day} className="relative flex h-full flex-1 items-end" onMouseEnter={() => setHover(i)}>
                    <div className="w-full rounded-t-[4px] transition-opacity" style={{ height: `${Math.max(d.revenue ? 2 : 0, (d.revenue / max) * 100)}%`, background: '#8b5cf6', opacity: hover === null || hover === i ? 1 : 0.45 }} />
                    {hover === i && <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-ink-900 px-2.5 py-1.5 text-xs shadow-xl"><p className="text-white/50">{fmtDate(d.day + 'T12:00:00+05:30')}</p><p className="font-semibold text-white">{inr(d.revenue)}</p><p className="text-white/50">{d.tickets} tickets</p></div>}
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-white/40"><span>{fmtDate(s.byDay[0].day + 'T12:00:00+05:30')}</span><span>Peak {inr(max)}</span><span>Today</span></div>
            </div>
          )}
        </section>
        <section className="glass rounded-2xl p-5">
          <h2 className="font-semibold">Top movies by revenue</h2>
          {s.topMovies.length ? <ul className="mt-4 space-y-3">{s.topMovies.map((m) => (
            <li key={m.title}><div className="flex justify-between text-sm"><span className="text-white/80">{m.title}</span><span className="tabular-nums text-white">{inr(m.revenue)}</span></div>
              <div className="mt-1 h-1.5 rounded-full bg-white/[0.05]"><div className="h-full rounded-full" style={{ width: `${(m.revenue / s.topMovies[0].revenue) * 100}%`, background: '#8b5cf6' }} /></div>
              <p className="mt-0.5 text-[11px] text-white/40">{m.tickets} tickets</p></li>))}</ul> : <p className="mt-4 text-sm text-white/45">No online sales yet.</p>}
        </section>
      </div>
    </div>
  );
}
