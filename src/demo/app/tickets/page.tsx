'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import QRCode from 'qrcode';
import type { BookingView } from '@/lib/server/bookings';
import { Ticket } from '@/components/ticket/Ticket';
import { api } from '@/lib/client';
import { routes } from '@/lib/routes';
import { loadDemo } from '@/lib/demo/lazy';
import { PageSkeleton, RequireUser } from '@/lib/demo/hooks';

type Data = BookingView & { cancellation: { allowed: boolean; deadline: string; amount: number; hours: number } };

function Inner() {
  const sp = useSearchParams();
  const id = sp.get('id') || '';
  const router = useRouter();
  const [d, setD] = useState<Data | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let off = () => {};
    const pull = () => api<Data>(`/api/bookings/${id}`).then((x) => {
      if (x.booking.status === 'pending') return router.replace(routes.checkout(id));
      setD(x);
      // Demo QR: encodes the booking reference only (there is no verification server on Pages).
      if (x.booking.status === 'confirmed') QRCode.toDataURL(`CINEVERSE-DEMO|${x.booking.code}|${x.booking.seatIds.join(',')}`, { margin: 1, width: 360, color: { dark: '#0a0b14', light: '#ffffff' } }).then(setQr);
      else setQr(null);
    }).catch((e) => setErr(e.message));
    pull();
    loadDemo().then((m) => { off = m.demo.subscribe(pull); });
    return () => off();
  }, [id, router]);
  if (err) return <div className="container-x pt-40 text-center font-display text-2xl">{err}</div>;
  if (!d) return <PageSkeleton />;
  return <Ticket view={d} qr={qr} fresh={sp.get('new') === '1'} cancellation={d.cancellation} />;
}
export default function DemoTicket() { return <Suspense fallback={<PageSkeleton />}><RequireUser><Inner /></RequireUser></Suspense>; }
