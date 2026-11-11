import { notFound } from 'next/navigation';
import { getScreen, getTheatre } from '@/lib/server/db';
import { LayoutEditor } from '@/components/admin/LayoutEditor';
export const dynamic = 'force-dynamic';
export default function Page({ params }: { params: { id: string } }) {
  const s = getScreen(params.id);
  if (!s) notFound();
  return <LayoutEditor screen={s} theatreName={getTheatre(s.theatreId)?.name ?? ''} />;
}
