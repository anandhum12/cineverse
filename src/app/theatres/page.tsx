import { db } from '@/lib/server/db';
import { ShowtimeExplorer } from '@/components/ShowtimeExplorer';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Cinemas near you' };
export default function TheatresPage() {
  return (
    <div className="container-x pt-32">
      <p className="eyebrow mb-2">Nearby</p>
      <h1 className="mb-8 font-display text-4xl font-bold sm:text-5xl">Cinemas near you</h1>
      <ShowtimeExplorer movies={db().movies} />
    </div>
  );
}
