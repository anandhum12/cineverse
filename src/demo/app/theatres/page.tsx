'use client';
import { ShowtimeExplorer } from '@/components/ShowtimeExplorer';
import { useDemoData, PageSkeleton } from '@/lib/demo/hooks';
export default function DemoTheatres() {
  const movies = useDemoData((d) => [...d.movies]);
  if (!movies) return <PageSkeleton />;
  return (
    <div className="container-x pt-32">
      <p className="eyebrow mb-2">Nearby</p>
      <h1 className="mb-8 font-display text-4xl font-bold sm:text-5xl">Cinemas near you</h1>
      <ShowtimeExplorer movies={movies} />
    </div>
  );
}
