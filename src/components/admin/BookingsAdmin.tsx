'use client';
import Link from 'next/link';
import { useState } from 'react';
import type { BookingView } from '@/lib/server/bookings';
import { useAdmin } from './useAdmin';
import { PageHead, Table } from './ui';
import { Segmented, Skeleton } from '../ui/misc';
import { fmtDate, fmtTime, inr } from '@/lib/format';

type Row = BookingView & { user: { name?: string; email?: string } };
export function BookingsAdmin() {
  const [status, setStatus] = useState<'' | 'confirmed' | 'pending' | 'cancelled' | 'failed'>('');
  const { items } = useAdmin<Row>('bookings', status ? `status=${status}` : '');
  return (
    <div>
      <PageHead title="Bookings" sub="Most recent 300"><Segmented value={status} onChange={setStatus} options={[{ id: '', label: 'All' }, { id: 'confirmed', label: 'Confirmed' }, { id: 'pending', label: 'Pending' }, { id: 'cancelled', label: 'Cancelled' }, { id: 'failed', label: 'Failed' }]} /></PageHead>
      {!items ? <Skeleton className="h-96" /> : (
        <Table head={['Booking', 'Customer', 'Show', 'Seats', 'Amount', 'Payment', 'Status']}>
          {items.map((b) => (
            <tr key={b.booking.id}>
              <td className="px-4 py-2 font-mono text-xs">{b.booking.status === 'confirmed' || b.booking.status === 'cancelled' ? <Link href={`/tickets/${b.booking.id}`} className="underline-offset-2 hover:underline">{b.booking.code}</Link> : b.booking.code}<p className="text-white/35">{fmtDate(b.booking.createdAt)} {fmtTime(b.booking.createdAt)}</p></td>
              <td className="px-4 py-2">{b.user.name}<p className="text-xs text-white/40">{b.user.email}</p></td>
              <td className="px-4 py-2">{b.movie.title}<p className="text-xs text-white/40">{b.theatre.name} · {b.screen.name} · {fmtDate(b.show.startsAt)} {fmtTime(b.show.startsAt)}</p></td>
              <td className="px-4 py-2 text-white/70">{b.booking.seatIds.join(', ')}</td>
              <td className="px-4 py-2 tabular-nums">{inr(b.booking.pricing.total)}{b.booking.refund && <p className="text-xs text-amber-200/80">refund {inr(b.booking.refund.amount)} · {b.booking.refund.status}</p>}</td>
              <td className="px-4 py-2 text-xs text-white/60">{b.payment ? `${b.payment.provider} · ${b.payment.status}${b.payment.method ? ` · ${b.payment.method}` : ''}` : '—'}</td>
              <td className="px-4 py-2"><span className="chip capitalize">{b.booking.status}</span></td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
