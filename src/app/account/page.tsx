import { redirect } from 'next/navigation';
import { db, publicUser } from '@/lib/server/db';
import { sessionUser } from '@/lib/server/auth';
import { bookingView } from '@/lib/server/bookings';
import { Account } from '@/components/account/Account';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'My account' };
export default async function AccountPage() {
  const u = await sessionUser();
  if (!u) redirect('/login?next=/account');
  const bookings = db().bookings.filter((b) => b.userId === u.id && ['confirmed', 'cancelled', 'failed'].includes(b.status)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(bookingView);
  const favourites = db().movies.filter((m) => u.favourites.includes(m.id));
  return <Account user={publicUser(u)} bookings={bookings} favourites={favourites} />;
}
