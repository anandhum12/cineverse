'use client';
import { Suspense, useEffect, useState } from 'react';
import type { BookingView } from '@/lib/server/bookings';
import type { User } from '@/lib/types';
import { Account } from '@/components/account/Account';
import { api } from '@/lib/client';
import { useDemoData, PageSkeleton, RequireUser } from '@/lib/demo/hooks';
import { useAppSession } from '@/lib/session';

function Inner() {
  const { user } = useAppSession();
  const [me, setMe] = useState<Omit<User, 'passwordHash'> | null>(null);
  const [bookings, setBookings] = useState<BookingView[] | null>(null);
  const favourites = useDemoData((d) => d.movies.filter((m) => d.users.find((u) => u.id === user?.id)?.favourites.includes(m.id)));
  useEffect(() => {
    api<{ user: Omit<User, 'passwordHash'> }>('/api/me').then((r) => setMe(r.user));
    api<{ bookings: BookingView[] }>('/api/bookings').then((r) => setBookings(r.bookings.filter((b) => ['confirmed', 'cancelled', 'failed'].includes(b.booking.status))));
  }, [user?.id]);
  if (!me || !bookings || !favourites) return <PageSkeleton />;
  return <Account user={me} bookings={bookings} favourites={favourites} />;
}
export default function DemoAccount() { return <Suspense fallback={<PageSkeleton />}><RequireUser><Inner /></RequireUser></Suspense>; }
