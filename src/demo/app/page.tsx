'use client';
import { Hero } from '@/components/Hero';
import { MovieRail } from '@/components/MovieRail';
import { NearYouRail } from '@/components/NearYouRail';
import { SignatureTeaser } from '@/components/SignatureTeaser';
import { useDemoData } from '@/lib/demo/hooks';
import { useAppSession } from '@/lib/session';
import { Skeleton } from '@/components/ui/misc';

export default function DemoHome() {
  const { user } = useAppSession();
  const d = useDemoData((x) => ({ movies: [...x.movies], favs: x.users.find((u) => u.id === user?.id)?.favourites ?? [] }));
  if (!d) return <div className="h-[100svh]"><Skeleton className="h-full w-full !rounded-none" /></div>;
  const { movies, favs } = d;
  const now = movies.filter((m) => m.status === 'now');
  const soon = movies.filter((m) => m.status === 'soon').sort((a, b) => a.releaseDate.localeCompare(b.releaseDate));
  const trending = [...movies].sort((a, b) => b.trending - a.trending);
  const favGenres = new Set(movies.filter((m) => favs.includes(m.id)).flatMap((m) => m.genres));
  const recommended = now.filter((m) => !favs.includes(m.id)).map((m) => ({ m, s: m.rating * 10 + m.trending * 0.3 + m.genres.filter((g) => favGenres.has(g)).length * 25 })).sort((a, b) => b.s - a.s).map((x) => x.m);
  return (
    <>
      <Hero movies={trending.filter((m) => m.status === 'now').slice(0, 4)} />
      <div className="relative -mt-16 space-y-2">
        <MovieRail id="now" eyebrow="In cinemas" title="Now showing" movies={now} />
        <NearYouRail movies={now} />
        <SignatureTeaser />
        <MovieRail id="trending" eyebrow="This week" title="Trending" movies={trending.slice(0, 10)} />
        <MovieRail id="top" eyebrow="Audience favourites" title="Top rated" movies={[...now].sort((a, b) => b.rating - a.rating)} />
        <MovieRail id="soon" eyebrow="Mark your calendar" title="Coming soon" movies={soon} />
        <MovieRail id="for-you" eyebrow={user ? `For ${user.name.split(' ')[0]}` : 'Picked for you'} title="Recommended" movies={recommended.slice(0, 8)} />
      </div>
    </>
  );
}
