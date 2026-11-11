import { db } from '@/lib/server/db';
import { MovieBrowser } from '@/components/MovieBrowser';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Movies' };
export default function MoviesPage() {
  return (
    <div className="container-x pt-32">
      <p className="eyebrow mb-2">Explore</p>
      <h1 className="font-display text-4xl font-bold sm:text-5xl">All movies</h1>
      <MovieBrowser movies={db().movies} />
    </div>
  );
}
