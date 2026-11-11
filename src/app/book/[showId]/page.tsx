import { notFound } from 'next/navigation';
import { showContext } from '@/lib/server/db';
import { BookingExperience } from '@/components/booking/BookingExperience';
export const dynamic = 'force-dynamic';
export function generateMetadata({ params }: { params: { showId: string } }) {
  const c = showContext(params.showId);
  return { title: c ? `Seats · ${c.movie.title} at ${c.theatre.name}` : 'Select seats', robots: { index: false } };
}
export default function BookPage({ params }: { params: { showId: string } }) {
  if (!showContext(params.showId)) notFound();
  return <BookingExperience showId={params.showId} />;
}
