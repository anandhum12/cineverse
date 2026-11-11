import { moviesInCity } from '@/lib/server/catalog';
import { ok, handle } from '@/lib/server/http';
export const dynamic = 'force-dynamic';
export const GET = handle(async (req: Request) => ok({ movieIds: moviesInCity(new URL(req.url).searchParams.get('city') || 'kochi') }));
