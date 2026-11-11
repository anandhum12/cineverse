import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import QRCode from 'qrcode';
import { db } from '@/lib/server/db';
import { sessionUser } from '@/lib/server/auth';
import { bookingView, cancellationQuote } from '@/lib/server/bookings';
import { ticketToken } from '@/lib/server/payments';
import { Ticket } from '@/components/ticket/Ticket';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your ticket', robots: { index: false } };

export default async function TicketPage({ params, searchParams }: { params: { id: string }; searchParams: { new?: string } }) {
  const user = await sessionUser();
  if (!user) redirect(`/login?next=/tickets/${params.id}`);
  const b = db().bookings.find((x) => x.id === params.id);
  if (!b || (b.userId !== user.id && user.role !== 'admin')) notFound();
  if (b.status === 'pending') redirect(`/checkout/${b.id}`);
  const h = headers();
  const origin = process.env.NEXTAUTH_URL || `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}`;
  const verifyUrl = `${origin}/api/tickets/verify?b=${b.id}&t=${ticketToken(b.id)}`;
  const qr = b.status === 'confirmed' ? await QRCode.toDataURL(verifyUrl, { margin: 1, width: 360, color: { dark: '#0a0b14', light: '#ffffff' }, errorCorrectionLevel: 'M' }) : null;
  return <Ticket view={bookingView(b)} qr={qr} fresh={searchParams.new === '1'} cancellation={cancellationQuote(b)} />;
}
