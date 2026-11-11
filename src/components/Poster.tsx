import type { Movie } from '@/lib/types';

/** Deterministic hash → [0,1) stream so each film's art is stable. */
function prng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}

type PosterMovie = Pick<Movie, 'id' | 'title' | 'palette' | 'motif' | 'posterUrl' | 'backdropUrl' | 'tagline'>;

/**
 * Generated key art. Uploaded artwork (admin) always wins; otherwise renders an
 * original abstract poster from the film's palette + motif. Clearly not studio art.
 */
export function Poster({ movie, variant = 'poster', className, showTitle = true }: { movie: PosterMovie; variant?: 'poster' | 'backdrop'; className?: string; showTitle?: boolean }) {
  const url = variant === 'backdrop' ? movie.backdropUrl || movie.posterUrl : movie.posterUrl;
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={`${movie.title} ${variant}`} loading="lazy" className={`h-full w-full object-cover ${className ?? ''}`} />;
  }
  const [c1, c2, c3] = movie.palette;
  const W = variant === 'poster' ? 400 : 1600, H = variant === 'poster' ? 600 : 900;
  const r = prng(movie.id);
  const id = `p${movie.id.replace(/[^a-z0-9]/gi, '')}${variant[0]}`;
  const cx = W * (0.35 + r() * 0.3), cy = H * (variant === 'poster' ? 0.38 : 0.45);
  const R = Math.min(W, H) * (0.22 + r() * 0.1);
  const q = (n: number) => Math.round(n * 100) / 100; // stable SSR/CSR serialisation

  const motif = (() => {
    switch (movie.motif) {
      case 'orb':
        return (<g><circle cx={cx} cy={cy} r={R * 1.9} fill={`url(#${id}g)`} opacity=".55" /><circle cx={cx} cy={cy} r={R} fill={`url(#${id}o)`} />
          <ellipse cx={cx} cy={cy} rx={R * 1.7} ry={R * 0.28} fill="none" stroke={c3} strokeOpacity=".7" strokeWidth="2" transform={`rotate(-14 ${cx} ${cy})`} /></g>);
      case 'rings':
        return <g>{Array.from({ length: 9 }, (_, i) => <circle key={i} cx={cx} cy={cy} r={R * (0.3 + i * 0.28)} fill="none" stroke={i % 2 ? c3 : c2} strokeOpacity={0.75 - i * 0.07} strokeWidth={1.5 + (i % 3)} />)}<circle cx={cx} cy={cy} r={R * 0.22} fill={c3} /></g>;
      case 'waves':
        return <g>{Array.from({ length: 14 }, (_, i) => { const y = H * 0.25 + i * (H * 0.045); const a = 18 + r() * 30; return <path key={i} d={`M0 ${y} Q ${W * 0.25} ${y - a} ${W * 0.5} ${y} T ${W} ${y}`} fill="none" stroke={i % 3 ? c2 : c3} strokeOpacity={0.15 + i * 0.045} strokeWidth="2" />; })}</g>;
      case 'grid': {
        const hz = H * 0.58;
        return (<g><rect x="0" y="0" width={W} height={hz} fill={`url(#${id}g)`} opacity=".7" /><circle cx={W / 2} cy={hz - R * 0.4} r={R * 0.9} fill={`url(#${id}o)`} />
          {Array.from({ length: 12 }, (_, i) => <line key={`h${i}`} x1="0" x2={W} y1={hz + (i * i * H) / 300} y2={hz + (i * i * H) / 300} stroke={c2} strokeOpacity=".55" />)}
          {Array.from({ length: 17 }, (_, i) => <line key={`v${i}`} x1={W / 2} y1={hz} x2={(i - 8) * W * 0.25 + W / 2} y2={H} stroke={c3} strokeOpacity=".4" />)}</g>);
      }
      case 'monolith':
        return (<g><circle cx={W / 2} cy={cy - R * 0.2} r={R * 1.6} fill={`url(#${id}g)`} opacity=".8" />
          <rect x={W / 2 - R * 0.28} y={cy - R * 1.1} width={R * 0.56} height={H} fill="#000" opacity=".85" />
          <rect x={W / 2 - R * 0.28} y={cy - R * 1.1} width={2} height={H} fill={c3} opacity=".8" /></g>);
      case 'rain':
        return (<g>{Array.from({ length: 70 }, (_, i) => { const x = r() * W, y = r() * H, l = 20 + r() * 60; return <line key={i} x1={x} y1={y} x2={x - l * 0.2} y2={y + l} stroke={c3} strokeOpacity={0.1 + r() * 0.35} strokeWidth="1.2" />; })}
          <circle cx={cx} cy={cy} r={R * 1.1} fill={`url(#${id}g)`} opacity=".9" /></g>);
      case 'sun':
      default:
        return (<g>{Array.from({ length: 24 }, (_, i) => { const a = (i / 24) * Math.PI * 2; return <line key={i} x1={cx} y1={cy} x2={q(cx + Math.cos(a) * W)} y2={q(cy + Math.sin(a) * W)} stroke={c3} strokeOpacity=".09" strokeWidth={8} />; })}
          <circle cx={cx} cy={cy} r={R * 1.5} fill={`url(#${id}g)`} /><circle cx={cx} cy={cy} r={R * 0.7} fill={c3} opacity=".95" /></g>);
    }
  })();

  const words = movie.title.toUpperCase().split(' ');
  const fs = variant === 'poster' ? Math.round(Math.min(62, (W - 56) / (Math.max(...words.map((w) => w.length), 4) * 0.98))) : 0;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className={`h-full w-full ${className ?? ''}`} role="img" aria-label={`${movie.title} key art`}>
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stopColor={c1} /><stop offset="1" stopColor="#020205" /></linearGradient>
        <radialGradient id={`${id}g`}><stop offset="0" stopColor={c2} stopOpacity=".95" /><stop offset="1" stopColor={c2} stopOpacity="0" /></radialGradient>
        <radialGradient id={`${id}o`} cx=".35" cy=".3"><stop offset="0" stopColor="#fff" stopOpacity=".95" /><stop offset=".25" stopColor={c3} /><stop offset="1" stopColor={c1} /></radialGradient>
        <linearGradient id={`${id}fade`} x1="0" y1="0" x2="0" y2="1"><stop offset=".45" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".92" /></linearGradient>
        <filter id={`${id}n`}><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" /><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .07 0" /></filter>
      </defs>
      <rect width={W} height={H} fill={`url(#${id}bg)`} />
      {motif}
      <rect width={W} height={H} fill={`url(#${id}fade)`} />
      <rect width={W} height={H} filter={`url(#${id}n)`} />
      {showTitle && variant === 'poster' && (
        <g fontFamily="var(--font-display), system-ui" fill="#fff">
          {words.map((w, i) => <text key={i} x={W / 2} y={H - 70 - (words.length - 1 - i) * fs * 1.02} textAnchor="middle" fontSize={fs} fontWeight="800" letterSpacing="1">{w}</text>)}
          <text x={W / 2} y={H - 36} textAnchor="middle" fontSize="12" fill="#fff" fillOpacity=".55" letterSpacing="4">A CINEVERSE PRESENTATION</text>
        </g>
      )}
    </svg>
  );
}
