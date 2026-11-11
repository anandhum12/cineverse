'use client';
import Link from 'next/link';
import { useState } from 'react';
import type { BookingView } from '@/lib/server/bookings';
import type { Movie, User } from '@/lib/types';
import { cx, fmtDate, fmtTime, inr } from '@/lib/format';
import { api } from '@/lib/client';
import { toast } from '@/lib/store';
import { Poster } from '../Poster';
import { Empty, Segmented } from '../ui/misc';
import { MovieCard } from '../MovieCard';
import { Button } from '../ui/Button';
import { routes } from '@/lib/routes';

type PublicUser = Omit<User, 'passwordHash'>;

export function Account({ user, bookings, favourites }: { user: PublicUser; bookings: BookingView[]; favourites: Movie[] }) {
  const [tab, setTab] = useState<'upcoming' | 'history' | 'favourites' | 'profile'>('upcoming');
  const now = Date.now();
  const upcoming = bookings.filter((b) => b.booking.status === 'confirmed' && Date.parse(b.show.startsAt) > now - 3 * 3600_000);
  const history = bookings.filter((b) => !upcoming.includes(b));
  return (
    <div className="container-x pb-16 pt-28">
      <div className="flex flex-wrap items-center gap-5">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-neon-violet to-neon-blue font-display text-2xl font-bold">{user.name[0]}</div>
        <div><h1 className="font-display text-3xl font-bold">{user.name}</h1><p className="text-sm text-white/50">{user.email}</p></div>
      </div>
      <div className="mt-8 overflow-x-auto"><Segmented value={tab} onChange={setTab} options={[{ id: 'upcoming', label: `Upcoming (${upcoming.length})` }, { id: 'history', label: 'History' }, { id: 'favourites', label: 'Favourites' }, { id: 'profile', label: 'Profile' }]} /></div>
      <div className="mt-6">
        {tab === 'upcoming' && (upcoming.length ? <List items={upcoming} /> : <Empty title="No upcoming shows"><Link href="/movies" className="underline">Find a movie</Link> and pick your seat.</Empty>)}
        {tab === 'history' && (history.length ? <List items={history} /> : <Empty title="No past bookings yet" />)}
        {tab === 'favourites' && (favourites.length ? <div className="flex flex-wrap gap-6">{favourites.map((m, i) => <MovieCard key={m.id} movie={m} index={i} />)}</div> : <Empty title="No favourites">Tap the heart on any movie page to save it here.</Empty>)}
        {tab === 'profile' && <Profile user={user} />}
      </div>
    </div>
  );
}

function List({ items }: { items: BookingView[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map(({ booking: b, movie, theatre, show, screen }) => (
        <Link key={b.id} href={routes.ticket(b.id)} className="glass group flex gap-4 rounded-3xl p-4 transition hover:ring-1 hover:ring-neon-violet/50 focus-ring">
          <div className="h-28 w-20 shrink-0 overflow-hidden rounded-xl"><Poster movie={movie} showTitle={false} /></div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2"><h3 className="truncate font-display text-lg font-semibold">{movie.title}</h3>
              <span className={cx('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase', b.status === 'confirmed' ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/10 text-white/50')}>{b.status}</span></div>
            <p className="truncate text-sm text-white/60">{theatre.name} · {screen.name}</p>
            <p className="text-sm text-white/60">{fmtDate(show.startsAt)} · {fmtTime(show.startsAt)}</p>
            <p className="mt-2 text-xs text-white/45">Seats {b.seatIds.join(', ')} · {inr(b.pricing.total)} · {b.code}</p>
            {b.refund && <p className="mt-1 text-xs text-amber-200/80">Refund {inr(b.refund.amount)} · {b.refund.status}</p>}
          </div>
        </Link>
      ))}
    </div>
  );
}

function Profile({ user }: { user: PublicUser }) {
  const [name, setName] = useState(user.name);
  const [pref, setPref] = useState(user.paymentPreference ?? null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await api('/api/me', { method: 'PATCH', json: { name, paymentPreference: pref } }); toast('success', 'Profile saved.'); } catch (e) { toast('error', (e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="glass max-w-xl space-y-5 rounded-3xl p-6">
      <label className="block"><span className="label">Display name</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></label>
      <div>
        <span className="label">Preferred payment method</span>
        <div className="grid grid-cols-2 gap-2">
          {(['upi', 'card', 'netbanking', 'wallet'] as const).map((m) => (
            <button key={m} onClick={() => setPref({ method: m, label: pref?.method === m ? pref.label : '' })} className={cx('rounded-2xl border px-3 py-2.5 text-sm capitalize', pref?.method === m ? 'border-neon-violet bg-neon-violet/10' : 'border-white/10')}>{m === 'upi' ? 'UPI' : m}</button>
          ))}
        </div>
        {pref && <input className="input mt-2" placeholder={pref.method === 'upi' ? 'e.g. name@okbank' : 'Label, e.g. "HDFC card"'} value={pref.label} maxLength={40} onChange={(e) => setPref({ ...pref, label: e.target.value })} />}
        <p className="mt-2 text-[11px] text-white/40">Only the method and a label are stored. Card numbers are never saved by CineVerse; saved cards are tokenised by the payment gateway.</p>
      </div>
      <Button onClick={save} loading={busy}>Save</Button>
    </div>
  );
}
