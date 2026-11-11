'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Checkout } from '@/components/checkout/Checkout';
import { PageSkeleton, RequireUser } from '@/lib/demo/hooks';
function Inner() { const id = useSearchParams().get('id') || ''; return <RequireUser><Checkout bookingId={id} /></RequireUser>; }
export default function DemoCheckout() { return <Suspense fallback={<PageSkeleton />}><Inner /></Suspense>; }
