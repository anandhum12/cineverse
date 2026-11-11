'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import type { BookingView } from '@/lib/server/bookings';
import { fmtDate, fmtTime, inr, cx } from '@/lib/format';
import { api } from '@/lib/client';
import { toast } from '@/lib/store';
import { Poster } from '../Poster';
import { Button } from '../ui/Button';
import { Modal } from '../ui/misc';

export function Ticket({ view, qr, fresh, cancellation }: { view: BookingView; qr: string | null; fresh: boolean; cancellation: { allowed: boolean; deadline: string; amount: number; hours: number } }) {
  const { booking: b, movie, theatre, screen, show, payment } = view;
  const ref = useRef<HTMLDivElement>(null);
  const [dl, setDl] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const router = useRouter();

  const download = async () => {
    if (!ref.current) return;
    setDl(true);
    try {
      const { toPng } = await import('html-to-image');
      const url = await toPng(ref.current, { pixelRatio: 2, backgroundColor: '#05060a', cacheBust: true });
      const a = document.createElement('a'); a.href = url; a.download = `CineVerse-${b.code}.png`; a.click();
    } catch { toast('error', 'Download failed. Try printing instead.'); } finally { setDl(false); }
  };
  const cancel = async () => {
    setCancelling(true);
    try { await api(`/api/bookings/${b.id}/cancel`, { method: 'POST' }); toast('success', `Booking cancelled. Refund of ${inr(cancellation.amount)} initiated.`); setConfirm(false); router.refresh(); }
    catch (e) { toast('error', (e as Error).message); } finally { setCancelling(false); }
  };

  const status = b.status === 'confirmed' ? null : b.status === 'cancelled' ? 'Cancelled' : b.status === 'failed' ? 'Not confirmed' : b.status;

  return (
    <div className="container-x pb-16 pt-28">
      {fresh && b.status === 'confirmed' && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto mb-8 max-w-md text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.15 }} className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-emerald-400/15 text-3xl text-emerald-300 ring-1 ring-emerald-300/40">✓</motion.div>
          <h1 className="font-display text-3xl font-bold">You&apos;re booked!</h1>
          <p className="mt-2 text-white/55">Payment verified. Show the QR code at the entrance.</p>
        </motion.div>
      )}
      <motion.div initial={{ opacity: 0, y: 30, rotateX: 12 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} style={{ perspective: 1000 }} className="mx-auto max-w-[420px]">
        <div ref={ref} className="relative overflow-hidden rounded-[2rem] bg-ink-850 shadow-[0_50px_120px_-40px_rgba(139,92,246,.6)] ring-1 ring-white/10">
          <div className="relative h-56">
            <Poster movie={movie} variant="backdrop" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink-850 via-ink-850/40 to-transparent" />
            <div className="absolute left-5 top-5 flex items-center gap-2"><span className="h-5 w-5 rounded-full bg-neon-gradient" /><span className="font-display text-sm font-bold">CineVerse</span></div>
            {status && <span className="absolute right-5 top-5 rounded-full bg-rose-500/80 px-3 py-1 text-xs font-bold uppercase">{status}</span>}
            <div className="absolute inset-x-5 bottom-3 flex items-end gap-4">
              <div className="h-24 w-16 shrink-0 overflow-hidden rounded-xl ring-1 ring-white/20"><Poster movie={movie} showTitle={false} /></div>
              <div><h2 className="font-display text-2xl font-bold leading-tight">{movie.title}</h2><p className="text-xs text-white/60">{movie.certification} · {show.language} · {show.format}</p></div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 px-6 pb-5 pt-4 text-sm">
            <Field k="Date" v={fmtDate(show.startsAt, { weekday: 'short', day: 'numeric', month: 'short' })} />
            <Field k="Showtime" v={fmtTime(show.startsAt)} />
            <Field k="Cinema" v={theatre.name} wide />
            <Field k="Screen" v={screen.name} />
            <Field k={`Seats (${b.seatIds.length})`} v={b.seatIds.join(', ')} />
          </div>
          <div className="relative flex items-center px-3">
            <span className="absolute -left-4 h-8 w-8 rounded-full bg-[#04050a]" /><span className="h-px flex-1 border-t-2 border-dashed border-white/15" /><span className="absolute -right-4 h-8 w-8 rounded-full bg-[#04050a]" />
          </div>
          <div className="flex items-center gap-5 p-6">
            <div className={cx('grid h-32 w-32 shrink-0 place-items-center rounded-2xl bg-white p-2', !qr && 'opacity-30')}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {qr ? <img src={qr} alt={`Entry QR code for booking ${b.code}`} className="h-full w-full" /> : <span className="text-center text-xs text-ink-950">Not valid for entry</span>}
            </div>
            <div className="min-w-0 space-y-2 text-xs">
              <Field k="Booking ID" v={b.code} mono />
              <Field k="Amount paid" v={inr(b.pricing.total)} />
              {payment && <Field k="Payment" v={`${payment.method?.toUpperCase() ?? payment.provider} · ${payment.status}`} />}
              {b.refund && <Field k="Refund" v={`${inr(b.refund.amount)} · ${b.refund.status}`} />}
            </div>
          </div>
        </div>
      </motion.div>
      <div className="no-print mx-auto mt-6 flex max-w-[420px] flex-wrap justify-center gap-3">
        <Button onClick={download} loading={dl}>Download ticket</Button>
        <Button variant="glass" onClick={() => window.print()}>Print</Button>
        <Button variant="outline" href="/account">My bookings</Button>
      </div>
      {b.status === 'confirmed' && (
        <p className="no-print mx-auto mt-6 max-w-[420px] text-center text-xs text-white/40">
          {cancellation.allowed ? <>Plans changed? <button onClick={() => setConfirm(true)} className="text-white/70 underline">Cancel booking</button> before {fmtDate(cancellation.deadline, { day: 'numeric', month: 'short' })} {fmtTime(cancellation.deadline)}.</> : `Cancellation closed ${cancellation.hours}h before showtime.`}
        </p>
      )}
      <Modal open={confirm} onClose={() => setConfirm(false)} label="Cancel booking">
        <h3 className="font-display text-xl font-bold">Cancel this booking?</h3>
        <p className="mt-2 text-sm text-white/60">Seats {b.seatIds.join(', ')} will be released. {inr(cancellation.amount)} (tickets + ticket GST) will be refunded to your original payment method. Convenience fees are non-refundable.</p>
        <div className="mt-6 flex gap-3"><Button variant="danger" onClick={cancel} loading={cancelling}>Yes, cancel</Button><Button variant="ghost" onClick={() => setConfirm(false)}>Keep it</Button></div>
      </Modal>
      <p className="no-print mt-10 text-center"><Link href="/" className="text-sm text-white/50 hover:text-white">← Back to movies</Link></p>
    </div>
  );
}

function Field({ k, v, wide, mono }: { k: string; v: string; wide?: boolean; mono?: boolean }) {
  return <div className={wide ? 'col-span-2' : ''}><p className="text-[10px] uppercase tracking-[0.18em] text-white/40">{k}</p><p className={cx('mt-0.5 font-semibold text-white', mono && 'font-mono tracking-wider')}>{v}</p></div>;
}
