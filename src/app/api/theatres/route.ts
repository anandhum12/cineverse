import { theatreListings } from '@/lib/server/catalog';
import { ok, handle } from '@/lib/server/http';
export const dynamic = 'force-dynamic';
export const GET = handle(async (req: Request) => {
  const p = new URL(req.url).searchParams;
  const num = (k: string) => (p.get(k) ? Number(p.get(k)) : undefined);
  return ok({ theatres: theatreListings({ cityId: p.get('city') || undefined, movieId: p.get('movie') || undefined, date: p.get('date') || undefined, lat: num('lat'), lng: num('lng') }) });
});
