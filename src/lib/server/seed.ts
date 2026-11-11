import type { City, Movie, Screen, SeatLayout, Show, Theatre } from '../types';
import { makeRow, rowLabel, computeSeats } from '../geometry';
import { istDay } from '../format';
import { CITIES } from '../cities';

// ─── Deterministic PRNG so seeds are stable across restarts ──────────────────
export function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
export function rng(seed: string) {
  let a = hash(seed);
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const daysFromNow = (d: number) => istDay(new Date(Date.now() + d * 864e5));

// ─── Movies (fictional catalogue; posters are generated art) ─────────────────
type MovieSeed = Omit<Movie, 'id' | 'slug' | 'createdAt' | 'releaseDate' | 'ratingSource'> & { releaseOffset: number };
const MOVIES: MovieSeed[] = [
  {
    title: 'Orbital Drift', tagline: 'Four hundred kilometres up, there is nowhere to hide.', status: 'now', releaseOffset: -9,
    synopsis: 'When a debris cascade cripples the last crewed station in low orbit, a rookie flight engineer has ninety minutes — one orbit — to bring her crew home before the station burns up over the Indian Ocean.',
    genres: ['Sci-Fi', 'Thriller'], durationMin: 142, languages: ['English', 'Hindi'], certification: 'UA', rating: 8.6, votes: 48210,
    formats: ['IMAX', 'IMAX 3D', 'Dolby Atmos', '2D'], director: 'Mira Castellanos', palette: ['#0b1d4f', '#4f8cff', '#b04cff'], motif: 'orb', trending: 96,
    cast: [{ name: 'Ines Valcourt', role: 'Dr. Lena Okafor' }, { name: 'Dev Raghunathan', role: 'Cmdr. Arjun Sethi' }, { name: 'Tomas Reyes', role: 'Pavel Moroz' }, { name: 'Hana Kiriyama', role: 'Mission Control' }],
    crew: [{ name: 'Mira Castellanos', role: 'Director' }, { name: 'Jonah Pell', role: 'Cinematography' }, { name: 'Aditi Varma', role: 'Music' }],
  },
  {
    title: 'The Last Monsoon', tagline: 'Some storms only come once.', status: 'now', releaseOffset: -16,
    synopsis: 'In a fishing village on the Malabar coast, three generations of one family wait out the fiercest monsoon in a century — and the secrets it washes ashore.',
    genres: ['Drama', 'Family'], durationMin: 131, languages: ['Malayalam', 'Tamil'], certification: 'U', rating: 8.9, votes: 30122,
    formats: ['2D', 'Dolby Atmos'], director: 'Anjali Menon Pillai', palette: ['#06212a', '#1fb6a6', '#f2c14e'], motif: 'rain', trending: 88,
    cast: [{ name: 'Rahul Krishnan', role: 'Thomas' }, { name: 'Meera Joseph', role: 'Annamma' }, { name: 'K. P. Varghese', role: 'Appachan' }],
    crew: [{ name: 'Anjali Menon Pillai', role: 'Director' }, { name: 'Sujith Ravi', role: 'Cinematography' }, { name: 'Bijibal Nair', role: 'Music' }],
  },
  {
    title: 'Neon Raga', tagline: 'Every city has a rhythm. This one wants blood.', status: 'now', releaseOffset: -3,
    synopsis: 'A classically trained violinist moonlights as a getaway driver in a rain-soaked Mumbai of 2049, until a heist goes wrong and the only witness is her own song.',
    genres: ['Action', 'Crime'], durationMin: 156, languages: ['Hindi', 'English', 'Telugu'], certification: 'A', rating: 7.9, votes: 61833,
    formats: ['IMAX', '4DX', 'Dolby Atmos', '2D'], director: 'Kabir Seth', palette: ['#1a0526', '#ff4fd8', '#3ee0ff'], motif: 'grid', trending: 99,
    cast: [{ name: 'Tara Sood', role: 'Naina' }, { name: 'Vikram Ahuja', role: 'Inspector Rane' }, { name: 'Zoya Merchant', role: 'Lilly' }],
    crew: [{ name: 'Kabir Seth', role: 'Director' }, { name: 'Ravi Kamat', role: 'Cinematography' }, { name: 'Ayaan Quadri', role: 'Music' }],
  },
  {
    title: 'Paper Lanterns', tagline: 'Light finds a way.', status: 'now', releaseOffset: -24,
    synopsis: 'An animated tale of a girl made of folded paper who must cross a city of wind to return a lantern to the moon.',
    genres: ['Animation', 'Adventure', 'Family'], durationMin: 98, languages: ['English', 'Hindi', 'Tamil'], certification: 'U', rating: 8.2, votes: 22410,
    formats: ['3D', '2D'], director: 'Sora Lindqvist', palette: ['#2a0f05', '#ff9f43', '#ffe1a8'], motif: 'sun', trending: 74,
    cast: [{ name: 'Lily Chen', role: 'Origami (voice)' }, { name: 'Marcus Bell', role: 'Gust (voice)' }],
    crew: [{ name: 'Sora Lindqvist', role: 'Director' }, { name: 'Nadia Okoro', role: 'Animation' }],
  },
  {
    title: 'Kingdom of Salt', tagline: 'Empires are built on what we can’t live without.', status: 'now', releaseOffset: -6,
    synopsis: 'A sweeping historical epic about the salt marchers of a fictional coastal kingdom and the queen who joined them.',
    genres: ['Historical', 'Drama', 'Action'], durationMin: 171, languages: ['Telugu', 'Hindi', 'Tamil', 'Malayalam'], certification: 'UA', rating: 8.4, votes: 77211,
    formats: ['IMAX', 'Dolby Atmos', '2D'], director: 'S. Narayana Rao', palette: ['#1d1205', '#e0a33a', '#fff1d6'], motif: 'monolith', trending: 91,
    cast: [{ name: 'Prabha Reddy', role: 'Queen Rudrama' }, { name: 'Arjun Teja', role: 'Veerabhadra' }, { name: 'Naseer Khan', role: 'Governor Hale' }],
    crew: [{ name: 'S. Narayana Rao', role: 'Director' }, { name: 'K. Senthil', role: 'Cinematography' }, { name: 'M. M. Keeravan', role: 'Music' }],
  },
  {
    title: 'Static', tagline: 'Don’t answer the radio.', status: 'now', releaseOffset: -2,
    synopsis: 'A late-night radio host in the Nilgiris starts receiving calls from listeners who died thirty years ago.',
    genres: ['Horror', 'Mystery'], durationMin: 109, languages: ['Tamil', 'English'], certification: 'A', rating: 7.4, votes: 15403,
    formats: ['Dolby Atmos', '2D'], director: 'Vetri Maaran S.', palette: ['#050607', '#5b6b7a', '#d1e3ff'], motif: 'waves', trending: 80,
    cast: [{ name: 'Lakshmi Priya', role: 'Kavya' }, { name: 'Siddharth Ram', role: 'Joseph' }],
    crew: [{ name: 'Vetri Maaran S.', role: 'Director' }, { name: 'Ilan Kovac', role: 'Sound Design' }],
  },
  {
    title: 'Half-Time', tagline: 'Forty-five minutes to change everything.', status: 'now', releaseOffset: -12,
    synopsis: 'A washed-up football coach gets one season with a girls’ team from a Kochi fishing harbour — and one shot at the state final.',
    genres: ['Sports', 'Drama', 'Comedy'], durationMin: 127, languages: ['Malayalam', 'Hindi'], certification: 'U', rating: 8.1, votes: 18904,
    formats: ['2D'], director: 'Basil Mathew', palette: ['#07170c', '#3ddc84', '#e8ffe9'], motif: 'rings', trending: 70,
    cast: [{ name: 'Joju Abraham', role: 'Coach Sunny' }, { name: 'Ann Mariya', role: 'Reshma' }],
    crew: [{ name: 'Basil Mathew', role: 'Director' }],
  },
  {
    title: 'Glasshouse', tagline: 'Everyone can see in. No one can get out.', status: 'now', releaseOffset: -20,
    synopsis: 'Six strangers wake inside a transparent smart-home in the middle of a desert, broadcast live to millions.',
    genres: ['Thriller', 'Sci-Fi'], durationMin: 118, languages: ['English'], certification: 'UA', rating: 7.2, votes: 33017,
    formats: ['IMAX', '2D'], director: 'Elena Duarte', palette: ['#03141c', '#6ee7ff', '#a5b4fc'], motif: 'grid', trending: 62,
    cast: [{ name: 'Noah Grant', role: 'Elias' }, { name: 'Priya Desai', role: 'Ruth' }],
    crew: [{ name: 'Elena Duarte', role: 'Director' }],
  },
  {
    title: 'Aurora Line', tagline: 'The last train north waits for no one.', status: 'soon', releaseOffset: 9,
    synopsis: 'A night train across the Arctic, a stolen manuscript, and a conductor who knows more than she says.',
    genres: ['Mystery', 'Romance'], durationMin: 124, languages: ['English', 'Hindi'], certification: 'UA', rating: 0, votes: 0,
    formats: ['IMAX', 'Dolby Atmos', '2D'], director: 'Freya Holm', palette: ['#03101f', '#2df5b5', '#8b5cf6'], motif: 'waves', trending: 85,
    cast: [{ name: 'Astrid Lund', role: 'Conductor Maren' }, { name: 'Rohan Kapur', role: 'Nikhil' }], crew: [{ name: 'Freya Holm', role: 'Director' }],
  },
  {
    title: 'Mythos: The Ninth Avatar', tagline: 'Legends don’t die. They return.', status: 'soon', releaseOffset: 18,
    synopsis: 'An archaeologist uncovers a temple beneath the Arabian Sea whose carvings predict the next hundred days.',
    genres: ['Fantasy', 'Action'], durationMin: 162, languages: ['Telugu', 'Hindi', 'Tamil', 'Malayalam', 'English'], certification: 'UA', rating: 0, votes: 0,
    formats: ['IMAX 3D', '3D', '4DX', '2D'], director: 'Prashanth Varma K.', palette: ['#160a02', '#ff7a18', '#ffd36e'], motif: 'sun', trending: 93,
    cast: [{ name: 'Teja Sajja R.', role: 'Hanu' }], crew: [{ name: 'Prashanth Varma K.', role: 'Director' }],
  },
  {
    title: 'Small Hours', tagline: 'Love, between 2 and 5 a.m.', status: 'soon', releaseOffset: 25,
    synopsis: 'Two night-shift workers in Bengaluru keep missing each other by minutes — until a power cut stops the city.',
    genres: ['Romance', 'Comedy'], durationMin: 112, languages: ['Kannada', 'English'], certification: 'U', rating: 0, votes: 0,
    formats: ['2D'], director: 'Hemanth Rao B.', palette: ['#14061f', '#c084fc', '#fbcfe8'], motif: 'orb', trending: 58,
    cast: [{ name: 'Rakshit Gowda', role: 'Manu' }, { name: 'Ruchi Shetty', role: 'Diya' }], crew: [{ name: 'Hemanth Rao B.', role: 'Director' }],
  },
  {
    title: 'Deep Blue Below', tagline: 'Eleven kilometres down, something is listening.', status: 'soon', releaseOffset: 34,
    synopsis: 'A research submersible descends into the Mariana Trench and finds the source of a signal heard for forty years.',
    genres: ['Sci-Fi', 'Adventure'], durationMin: 138, languages: ['English', 'Hindi'], certification: 'UA', rating: 0, votes: 0,
    formats: ['IMAX', 'IMAX 3D', 'Dolby Atmos'], director: 'James Okonkwo', palette: ['#010b1a', '#0077ff', '#5ef2ff'], motif: 'rings', trending: 77,
    cast: [{ name: 'Mara Ellis', role: 'Dr. Ada Kwan' }], crew: [{ name: 'James Okonkwo', role: 'Director' }],
  },
];

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function seedMovies(): Movie[] {
  return MOVIES.map(({ releaseOffset, ...m }, i) => ({
    ...m,
    id: `mv_${slugify(m.title)}`,
    slug: slugify(m.title),
    releaseDate: daysFromNow(releaseOffset),
    ratingSource: 'CineVerse verified audience',
    posterUrl: null,
    backdropUrl: null,
    trailerUrl: null,
    createdAt: new Date(Date.now() - i * 1000).toISOString(),
  }));
}

// ─── Cities & theatres (fictional cinemas at real neighbourhood coordinates) ─
export { CITIES };

const BRANDS = [
  { brand: 'Nebula Cinemas', kinds: ['imax', 'multiplex', 'lux'] as const },
  { brand: 'Lumen Multiplex', kinds: ['multiplex', 'multiplex'] as const },
  { brand: 'Starlight Screens', kinds: ['multiplex', 'lux'] as const },
];
const FACILITIES = ['Recliners', 'Dolby Atmos', 'Food & Beverage', 'Parking', 'Wheelchair access', 'M-Ticket', 'Laser projection', 'Lounge', 'Kids zone', 'Valet'];

// ─── Screen layout templates ────────────────────────────────────────────────
function categories(kind: 'imax' | 'multiplex' | 'lux') {
  const base = kind === 'imax' ? 1.45 : kind === 'lux' ? 1.6 : 1;
  return [
    { id: 'std', name: 'Classic', kind: 'standard' as const, price: Math.round(190 * base) },
    { id: 'prm', name: 'Prime', kind: 'premium' as const, price: Math.round(260 * base) },
    { id: 'rcl', name: 'Recliner', kind: 'recliner' as const, price: Math.round(450 * base) },
    { id: 'vip', name: 'VIP Lounge', kind: 'vip' as const, price: Math.round(650 * base) },
  ];
}

export function layoutTemplate(kind: 'imax' | 'multiplex' | 'lux'): SeatLayout {
  const rows = [];
  if (kind === 'imax') {
    for (let i = 0; i < 14; i++) {
      const label = rowLabel(i);
      const cat = i < 4 ? 'std' : i < 11 ? 'prm' : 'rcl';
      if (cat === 'rcl') rows.push(makeRow(label, cat, 12, [3, 9]));
      else rows.push(makeRow(label, cat, 24, [5, 19], { accessible: i === 0 ? [1, 24] : [], walkwayAfter: i === 6 }));
    }
    return { rows, categories: categories(kind).filter((c) => c.id !== 'vip'), exits: [{ side: 'left', rowIndex: 0 }, { side: 'right', rowIndex: 0 }, { side: 'left', rowIndex: 7 }, { side: 'right', rowIndex: 7 }, { side: 'rear', rowIndex: 13 }],
      geometry: { screenWidthM: 21, screenHeightM: 15.4, screenElevationM: 0.9, firstRowDistanceM: 5.2, rowSpacingM: 1.05, seatWidthM: 0.56, rakeM: 0.42, curvature: 0.008, walkwayDepthM: 1.4 } };
  }
  if (kind === 'lux') {
    for (let i = 0; i < 6; i++) rows.push(makeRow(rowLabel(i), i < 4 ? 'rcl' : 'vip', i < 4 ? 10 : 8, i < 4 ? [2, 8] : [2, 4, 6], { accessible: i === 0 ? [1] : [] }));
    return { rows, categories: categories(kind).filter((c) => c.kind !== 'standard' && c.kind !== 'premium'), exits: [{ side: 'left', rowIndex: 0 }, { side: 'rear', rowIndex: 5 }],
      geometry: { screenWidthM: 11, screenHeightM: 4.6, screenElevationM: 1.1, firstRowDistanceM: 4.4, rowSpacingM: 1.1, seatWidthM: 0.6, rakeM: 0.38, curvature: 0.004, walkwayDepthM: 1.2 } };
  }
  for (let i = 0; i < 12; i++) {
    const label = rowLabel(i);
    const cat = i < 3 ? 'std' : i < 10 ? 'prm' : 'rcl';
    if (cat === 'rcl') rows.push(makeRow(label, cat, 10, [5]));
    else rows.push(makeRow(label, cat, 18, [4, 14], { accessible: i === 0 ? [1, 18] : [], walkwayAfter: i === 4 }));
  }
  return { rows, categories: categories(kind).filter((c) => c.id !== 'vip'), exits: [{ side: 'left', rowIndex: 0 }, { side: 'right', rowIndex: 5 }, { side: 'rear', rowIndex: 11 }],
    geometry: { screenWidthM: 14, screenHeightM: 6, screenElevationM: 1.2, firstRowDistanceM: 4.6, rowSpacingM: 1.0, seatWidthM: 0.55, rakeM: 0.32, curvature: 0.006, walkwayDepthM: 1.2 } };
}

export function seedTheatres(): { theatres: Theatre[]; screens: Screen[] } {
  const theatres: Theatre[] = [];
  const screens: Screen[] = [];
  for (const city of CITIES) {
    BRANDS.forEach((b, bi) => {
      const area = city.areas[bi % city.areas.length];
      const r = rng(city.id + b.brand);
      const id = `th_${city.id}_${bi}`;
      theatres.push({
        id, name: `${b.brand} ${area.name}`, brand: b.brand, cityId: city.id, area: area.name,
        address: `${Math.floor(r() * 300) + 1}, ${area.name} Main Road, ${city.name}, ${city.state}`,
        lat: area.lat + (r() - 0.5) * 0.01, lng: area.lng + (r() - 0.5) * 0.01,
        rating: Math.round((3.8 + r() * 1.1) * 10) / 10,
        facilities: FACILITIES.filter(() => r() > 0.45).slice(0, 6).concat(['M-Ticket']).filter((v, i, a) => a.indexOf(v) === i),
        cancellationHours: 2,
      });
      b.kinds.forEach((kind, si) => {
        screens.push({
          id: `${id}_s${si + 1}`, theatreId: id,
          name: kind === 'imax' ? 'IMAX Laser' : kind === 'lux' ? `Lux ${si + 1}` : `Audi ${si + 1}`,
          formats: kind === 'imax' ? ['IMAX', 'IMAX 3D', '2D'] : kind === 'lux' ? ['Dolby Atmos', '2D'] : si % 2 ? ['3D', '2D', '4DX'] : ['Dolby Atmos', '2D', '3D'],
          layout: layoutTemplate(kind),
        });
      });
    });
  }
  return { theatres, screens };
}

// ─── Shows: generated for a rolling window of days ──────────────────────────
const SLOTS = ['09:45', '13:10', '16:30', '19:50', '22:55'];

export function generateShows(movies: Movie[], screens: Screen[], fromDay: number, toDay: number, existing: Set<string>): Show[] {
  const now = movies.filter((m) => m.status === 'now');
  const out: Show[] = [];
  for (let d = fromDay; d <= toDay; d++) {
    const day = daysFromNow(d);
    const dow = new Date(`${day}T12:00:00+05:30`).getUTCDay();
    const weekend = dow === 0 || dow === 6;
    screens.forEach((sc, si) => {
      SLOTS.forEach((slot, ti) => {
        const id = `sh_${sc.id}_${day.replace(/-/g, '')}_${ti}`;
        if (existing.has(id)) return;
        const r = rng(id);
        const pool = now.filter((m) => m.formats.some((f) => sc.formats.includes(f)));
        if (!pool.length) return;
        const movie = pool[(si * 3 + ti + d) % pool.length];
        const format = movie.formats.find((f) => sc.formats.includes(f))!;
        const language = movie.languages[Math.floor(r() * movie.languages.length)];
        const startsAt = new Date(`${day}T${slot}:00+05:30`).toISOString();
        out.push({ id, movieId: movie.id, screenId: sc.id, startsAt, language, format,
          priceFactor: (weekend ? 1.15 : 1) * (ti >= 3 ? 1.1 : ti === 0 ? 0.85 : 1),
          soldOffline: seedOccupancy(sc.layout, r, d, ti) });
      });
    });
  }
  return out;
}

/** Plausible occupancy: busier evenings / sooner dates, clustered toward the centre. */
function seedOccupancy(layout: SeatLayout, r: () => number, dayOffset: number, slot: number): string[] {
  const seats = computeSeats(layout);
  const fill = Math.max(0.05, Math.min(0.75, 0.15 + (slot >= 3 ? 0.3 : 0.08) - dayOffset * 0.06 + r() * 0.15));
  const maxX = Math.max(...seats.map((s) => Math.abs(s.x))) || 1;
  const rows = layout.rows.length;
  return seats.filter((s) => {
    const centrality = 1 - Math.abs(s.x) / maxX;
    const rowPref = 1 - Math.abs(s.rowIndex / rows - 0.65);
    return r() < fill * (0.45 + centrality * 0.7) * (0.6 + rowPref * 0.6);
  }).map((s) => s.id);
}
