'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import type { BookingView } from '@/lib/server/bookings';
import { api } from '@/lib/client';
import { cx, fmtDate, fmtTime, inr } from '@/lib/format';
import { toast } from '@/lib/store';
import { Poster } from '../Poster';
import { Button } from '../ui/Button';
import { Skeleton } from '../ui/misc';
import { HoldTimer, useCountdown } from '../booking/HoldTimer';
import { routes } from '@/lib/routes';

type Data = BookingView & { gateway: { provider: 'razorpay' | 'sandbox'; keyId: string | null; sandbox: boolean }; user: { name: string; email: string }; cancellation: { allowed: boolean; deadline: string; amount: number; hours: number } };
const METHODS = [
  { id: 'upi', label: 'UPI', hint: 'GPay, PhonePe, Paytm, BHIM' },
  { id: 'card', label: 'Credit / Debit card', hint: 'Visa, Mastercard, RuPay, Amex' },
  { id: 'netbanking', label: 'Net banking', hint: 'All major banks' },
  { id: 'wallet', label: 'Wallets', hint: 'Paytm, Amazon Pay, Mobikwik' },
] as const;

declare global { interface Window { Razorpay?: new (o: Record<string, unknown>) => { open: () => void; on: (e: string, f: (r: { error: { description: string } }) => void) => void } } }

function loadRazorpay() {
  return new Promise<boolean>((res) => {
    if (window.Razorpay) return res(true);
    const s = document.createElement('script'); s.src = 'https://checkout.razorpay.com/v1/checkout.js'; s.onload = () => res(true); s.onerror = () => res(false); document.body.appendChild(s);
  });
}

export function Checkout({ bookingId }: { bookingId: string }) {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [method, setMethod] = useState<(typeof METHODS)[number]['id']>('upi');
  const [phase, setPhase] = useState<'idle' | 'paying' | 'verifying' | 'failed'>('idle');
  const [failMsg, setFailMsg] = useState('');
  const router = useRouter();
  const left = useCountdown(d ? Date.parse(d.booking.expiresAt) : null);

  useEffect(() => { api<Data>(`/api/bookings/${bookingId}`).then((x) => { setD(x); if (x.booking.status === 'confirmed') router.replace(routes.ticket(bookingId)); }).catch((e) => setErr(e.message)); }, [bookingId, router]);

  const verify = async (p: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
    setPhase('verifying');
    try {
      await api('/api/payments/verify', { method: 'POST', json: { bookingId, ...p, method } });
      router.replace(routes.ticket(bookingId, true));
    } catch (e) { setPhase('failed'); setFailMsg((e as Error).message); }
  };
  const failed = async (reason: string) => {
    setPhase('failed'); setFailMsg(reason);
    api('/api/payments/failed', { method: 'POST', json: { bookingId, reason } }).catch(() => {});
  };

  const pay = async (outcome: 'success' | 'failure' = 'success') => {
    if (!d?.payment) return;
    setPhase('paying'); setFailMsg('');
    if (d.gateway.provider === 'razorpay') {
      if (!(await loadRazorpay()) || !window.Razorpay) return failed('Could not load the payment gateway. Check your connection.');
      const rz = new window.Razorpay({
        key: d.gateway.keyId, order_id: d.payment.orderId, amount: Math.round(d.payment.amount * 100), currency: 'INR', name: 'CineVerse', description: `${d.movie.title} · ${d.booking.seatIds.join(', ')}`,
        prefill: { name: d.user.name, email: d.user.email, method }, theme: { color: '#8b5cf6' },
        handler: verify, modal: { ondismiss: () => setPhase('idle') },
      });
      rz.on('payment.failed', (r) => failed(r.error.description));
      rz.open();
      return;
    }
    try {
      const p = await api<{ razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }>('/api/payments/sandbox', { method: 'POST', json: { bookingId, outcome, method } });
      await verify(p);
    } catch (e) { failed((e as Error).message); }
  };

  if (err) return <div className="container-x pt-40 text-center"><p className="font-display text-2xl">{err}</p><Link href="/" className="mt-3 inline-block underline">Home</Link></div>;
  if (!d) return <div className="container-x grid gap-6 pt-32 lg:grid-cols-2"><Skeleton className="h-96 !rounded-3xl" /><Skeleton className="h-96 !rounded-3xl" /></div>;

  const b = d.booking, pr = b.pricing;
  const expired = left === 0 || b.status === 'expired';
  return (
    <div className="container-x pb-20 pt-28">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="eyebrow">Checkout</p><h1 className="font-display text-3xl font-bold">Review & pay</h1></div>
        <HoldTimer expiresAt={Date.parse(b.expiresAt)} label="Complete payment in" />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <section className="glass overflow-hidden rounded-[2rem]">
          <div className="relative flex gap-5 p-6">
            <div className="h-36 w-24 shrink-0 overflow-hidden rounded-2xl ring-1 ring-white/10"><Poster movie={d.movie} showTitle={false} /></div>
            <div className="min-w-0">
              <h2 className="font-display text-2xl font-bold">{d.movie.title}</h2>
              <p className="mt-1 text-sm text-white/55">{d.movie.certification} · {d.show.language} · {d.show.format}</p>
              <p className="mt-3 text-sm">{d.theatre.name}</p>
              <p className="text-sm text-white/55">{d.screen.name} · {fmtDate(d.show.startsAt, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · {fmtTime(d.show.startsAt)}</p>
            </div>
          </div>
          <div className="border-t border-dashed border-white/10 p-6">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-white/55">Seats</dt><dd className="font-semibold">{b.seatIds.join(', ')}</dd></div>
              {pr.lines.map((l) => <div key={l.seatId} className="flex justify-between text-white/70"><dt>{l.seatId} · {l.categoryName}</dt><dd>{inr(l.price)}</dd></div>)}
              <div className="flex justify-between text-white/55"><dt>Ticket subtotal</dt><dd>{inr(pr.subtotal)}</dd></div>
              <div className="flex justify-between text-white/55"><dt>GST on tickets</dt><dd>{inr(pr.gstOnTickets)}</dd></div>
              <div className="flex justify-between text-white/55"><dt>Convenience fee</dt><dd>{inr(pr.convenienceFee)}</dd></div>
              <div className="flex justify-between text-white/55"><dt>GST on fee (18%)</dt><dd>{inr(pr.gstOnFee)}</dd></div>
              <div className="flex justify-between border-t border-white/10 pt-3 text-lg font-bold"><dt>Total payable</dt><dd className="text-gradient">{inr(pr.total)}</dd></div>
            </dl>
            <p className="mt-4 text-xs text-white/40">Cancellable until {d.cancellation.hours}h before showtime. Ticket amount + ticket GST is refunded; convenience fees are non-refundable.</p>
          </div>
        </section>

        <section className="glass rounded-[2rem] p-6">
          <h2 className="font-display text-xl font-semibold">Payment method</h2>
          <div className="mt-4 space-y-2" role="radiogroup">
            {METHODS.map((m) => (
              <button key={m.id} role="radio" aria-checked={method === m.id} onClick={() => setMethod(m.id)} className={cx('flex w-full items-center justify-between rounded-2xl border p-4 text-left transition focus-ring', method === m.id ? 'border-neon-violet bg-neon-violet/10' : 'border-white/10 hover:border-white/25')}>
                <span><span className="block text-sm font-semibold">{m.label}</span><span className="text-xs text-white/45">{m.hint}</span></span>
                <span className={cx('grid h-5 w-5 place-items-center rounded-full border', method === m.id ? 'border-neon-violet' : 'border-white/25')}>{method === m.id && <span className="h-2.5 w-2.5 rounded-full bg-neon-violet" />}</span>
              </button>
            ))}
          </div>
          {d.gateway.provider === 'sandbox' && (
            <p className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-400/10 p-3 text-xs text-amber-100">Sandbox gateway: no real money moves. Add Razorpay keys in <code>.env.local</code> to use the live Razorpay checkout. Verification runs on the server either way.</p>
          )}
          <AnimatePresence>
            {phase === 'failed' && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100" role="alert">
                <b>Payment failed.</b> {failMsg} {!expired && 'Your seats are still held, so you can try again.'}
              </motion.div>
            )}
          </AnimatePresence>
          <div className="mt-6 space-y-3">
            {expired ? (
              <div className="text-center"><p className="text-sm text-white/60">This hold expired and the seats were released.</p><Button href={routes.book(d.show.id)} className="mt-3">Choose seats again</Button></div>
            ) : (
              <>
                <Button size="lg" className="w-full" onClick={() => pay('success')} loading={phase === 'paying' || phase === 'verifying'} magnetic>
                  {phase === 'verifying' ? 'Verifying payment…' : phase === 'failed' ? `Retry · ${inr(pr.total)}` : `Pay ${inr(pr.total)}`}
                </Button>
                {d.gateway.provider === 'sandbox' && <button onClick={() => pay('failure')} disabled={phase === 'paying' || phase === 'verifying'} className="w-full text-center text-xs text-white/40 underline-offset-4 hover:text-white/70 hover:underline">Simulate a declined payment</button>}
              </>
            )}
          </div>
          <p className="mt-6 flex items-center justify-center gap-2 text-[11px] text-white/35"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>Payments are verified server-side. Card details never touch CineVerse servers.</p>
        </section>
      </div>
    </div>
  );
}
