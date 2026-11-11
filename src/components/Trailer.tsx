'use client';
import { motion } from 'framer-motion';
import type { Movie } from '@/lib/types';
import { Modal } from './ui/misc';
import { Poster } from './Poster';

function youtubeId(url: string) {
  const m = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
  return m?.[1];
}

/** Plays an uploaded trailer (YouTube or MP4). Without one, shows a clearly-labelled generated teaser. */
export function Trailer({ movie, open, onClose }: { movie: Movie; open: boolean; onClose: () => void }) {
  const yt = movie.trailerUrl ? youtubeId(movie.trailerUrl) : undefined;
  return (
    <Modal open={open} onClose={onClose} label={`${movie.title} trailer`} className="!max-w-5xl !p-0 sm:!max-w-5xl">
      <div className="relative aspect-video w-full overflow-hidden rounded-t-3xl bg-black sm:rounded-3xl">
        {yt ? (
          <iframe className="absolute inset-0 h-full w-full" src={`https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0`} title={`${movie.title} trailer`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
        ) : movie.trailerUrl ? (
          <video className="absolute inset-0 h-full w-full" src={movie.trailerUrl} controls autoPlay playsInline />
        ) : (
          <div className="absolute inset-0">
            <motion.div className="absolute inset-0" initial={{ scale: 1.25 }} animate={{ scale: 1 }} transition={{ duration: 14, ease: 'linear' }}>
              <Poster movie={movie} variant="backdrop" />
            </motion.div>
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40" />
            <motion.div className="absolute inset-x-0 bottom-0 p-8 sm:p-12" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8, duration: 1.2 }}>
              <p className="eyebrow mb-3 text-neon-cyan/80">Generated teaser · no trailer uploaded yet</p>
              <motion.h3 className="font-display text-4xl font-extrabold sm:text-6xl" initial={{ letterSpacing: '0.4em', opacity: 0 }} animate={{ letterSpacing: '0.02em', opacity: 1 }} transition={{ delay: 1.2, duration: 2.4, ease: [0.22, 1, 0.36, 1] }}>{movie.title}</motion.h3>
              <motion.p className="mt-3 max-w-xl text-white/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3 }}>{movie.tagline}</motion.p>
            </motion.div>
          </div>
        )}
      </div>
    </Modal>
  );
}
