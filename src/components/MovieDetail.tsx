import type { Movie, Review } from '@/lib/types';
import { Poster } from './Poster';
import { MovieActions } from './MovieActions';
import { ShowtimeExplorer } from './ShowtimeExplorer';
import { Stars } from './ui/misc';
import { fmtLongDate, runtime } from '@/lib/format';

/** Movie details page body, shared by the server route and the Pages demo. */
export function MovieDetail({ movie, reviews, initialFav }: { movie: Movie; reviews: Review[]; initialFav: boolean }) {
  const jsonLd = { '@context': 'https://schema.org', '@type': 'Movie', name: movie.title, description: movie.synopsis, director: { '@type': 'Person', name: movie.director }, duration: `PT${movie.durationMin}M`, genre: movie.genres, datePublished: movie.releaseDate, ...(movie.votes ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: movie.rating, bestRating: 10, ratingCount: movie.votes } } : {}) };
  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="relative min-h-[88vh] overflow-hidden">
        <div className="absolute inset-0 scale-105"><Poster movie={movie} variant="backdrop" /></div>
        <div className="absolute inset-0 bg-gradient-to-r from-[#04050a] via-[#04050a]/85 to-[#04050a]/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#04050a] via-transparent to-transparent" />
        <div className="container-x relative grid items-end gap-10 pb-16 pt-36 lg:grid-cols-[300px_1fr] lg:pt-44">
          <div className="mx-auto w-[220px] overflow-hidden rounded-3xl shadow-[0_40px_120px_-30px_rgba(139,92,246,.6)] ring-1 ring-white/15 sm:w-[260px] lg:mx-0 lg:w-full">
            <div className="aspect-[2/3]"><Poster movie={movie} /></div>
          </div>
          <div className="max-w-3xl">
            <div className="mb-4 flex flex-wrap gap-2">{movie.formats.map((f) => <span key={f} className="chip">{f}</span>)}<span className="chip">{movie.certification}</span></div>
            <h1 className="font-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-7xl">{movie.title}</h1>
            <p className="mt-4 text-xl text-white/80">{movie.tagline}</p>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/60">
              {movie.rating > 0 ? <span className="flex items-center gap-2"><Stars value={movie.rating} size={15} /><span className="text-xs text-white/40">{movie.votes.toLocaleString('en-IN')} votes · {movie.ratingSource}</span></span> : <span className="text-neon-cyan">Releasing {fmtLongDate(movie.releaseDate)}</span>}
              <span>{runtime(movie.durationMin)}</span><span>{movie.genres.join(', ')}</span>
            </div>
            <p className="mt-6 max-w-2xl leading-relaxed text-white/65">{movie.synopsis}</p>
            <dl className="mt-6 grid max-w-xl grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <div><dt className="eyebrow">Director</dt><dd className="mt-1 text-white/85">{movie.director}</dd></div>
              <div><dt className="eyebrow">Languages</dt><dd className="mt-1 text-white/85">{movie.languages.join(', ')}</dd></div>
              <div><dt className="eyebrow">Release</dt><dd className="mt-1 text-white/85">{fmtLongDate(movie.releaseDate)}</dd></div>
            </dl>
            <MovieActions movie={movie} initialFav={initialFav} />
          </div>
        </div>
      </section>

      <section className="container-x py-10" aria-labelledby="cast-h">
        <h2 id="cast-h" className="font-display text-2xl font-bold">Cast & crew</h2>
        <div className="no-scrollbar mt-5 flex gap-4 overflow-x-auto pb-2">
          {[...movie.cast, ...movie.crew].map((p, i) => (
            <div key={i} className="glass w-[150px] shrink-0 rounded-2xl p-4">
              <div className="mb-3 grid h-14 w-14 place-items-center rounded-full font-display text-lg font-bold" style={{ background: `linear-gradient(135deg, ${movie.palette[1]}, ${movie.palette[2]})` }}>{p.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</div>
              <p className="truncate text-sm font-semibold">{p.name}</p><p className="truncate text-xs text-white/45">{p.role}</p>
            </div>
          ))}
        </div>
      </section>

      {movie.status === 'now' ? (
        <section className="container-x py-10" aria-labelledby="st-h">
          <p className="eyebrow mb-2">Step 1 · Date &nbsp;→&nbsp; 2 · Cinema &nbsp;→&nbsp; 3 · Showtime &nbsp;→&nbsp; 4 · Seats</p>
          <h2 id="st-h" className="mb-6 font-display text-3xl font-bold">Showtimes near you</h2>
          <ShowtimeExplorer movie={movie} />
        </section>
      ) : (
        <section className="container-x py-10"><div className="glass rounded-3xl p-8 text-center"><p className="font-display text-2xl">Bookings open soon</p><p className="mt-2 text-white/55">Releasing {fmtLongDate(movie.releaseDate)}. Add it to favourites to find it fast when bookings open.</p></div></section>
      )}

      {reviews.length > 0 && (
        <section className="container-x py-10"><h2 className="font-display text-2xl font-bold">Audience reviews</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">{reviews.map((r) => <div key={r.id} className="glass rounded-2xl p-5"><div className="flex justify-between text-sm"><b>{r.userName}</b><Stars value={r.rating} /></div><p className="mt-2 text-sm text-white/65">{r.text}</p></div>)}</div>
        </section>
      )}
    </article>
  );
}
