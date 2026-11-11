'use client';
import { MovieBrowser } from '@/components/MovieBrowser';
import { useDemoData, PageSkeleton } from '@/lib/demo/hooks';
export default function DemoMovies() {
  const movies = useDemoData((d) => [...d.movies]);
  if (!movies) return <PageSkeleton />;
  return (
    <div className="container-x pt-32">
      <p className="eyebrow mb-2">Explore</p>
      <h1 className="font-display text-4xl font-bold sm:text-5xl">All movies</h1>
      <MovieBrowser movies={movies} />
    </div>
  );
}
