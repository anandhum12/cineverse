'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { BookingExperience } from '@/components/booking/BookingExperience';
import { PageSkeleton } from '@/lib/demo/hooks';
function Inner() { const id = useSearchParams().get('show') || ''; return <BookingExperience key={id} showId={id} />; }
export default function DemoBook() { return <Suspense fallback={<PageSkeleton />}><Inner /></Suspense>; }
