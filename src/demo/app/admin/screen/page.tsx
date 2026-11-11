'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { LayoutEditor } from '@/components/admin/LayoutEditor';
import { useDemoData, PageSkeleton } from '@/lib/demo/hooks';
function Inner() {
  const id = useSearchParams().get('id') || '';
  const d = useDemoData((x) => { const s = x.screens.find((y) => y.id === id); return s ? { screen: s, theatre: x.theatres.find((t) => t.id === s.theatreId)?.name ?? '' } : { screen: null, theatre: '' }; });
  if (!d) return <PageSkeleton />;
  if (!d.screen) return <p className="pt-10 text-white/60">Screen not found.</p>;
  return <LayoutEditor key={d.screen.id} screen={d.screen} theatreName={d.theatre} />;
}
export default function Page() { return <Suspense fallback={<PageSkeleton />}><Inner /></Suspense>; }
