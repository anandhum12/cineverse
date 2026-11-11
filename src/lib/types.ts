// ─── Domain model ────────────────────────────────────────────────────────────
// These types mirror prisma/schema.prisma. The running app persists them in the
// file-backed store (src/lib/server/db.ts); the Prisma schema is the Postgres target.

export type MovieStatus = 'now' | 'soon';
export type ScreenFormat = '2D' | '3D' | 'IMAX' | 'IMAX 3D' | 'Dolby Atmos' | '4DX';
export type Motif = 'orb' | 'rings' | 'waves' | 'grid' | 'monolith' | 'rain' | 'sun';

export interface Person { name: string; role: string }

export interface Movie {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  synopsis: string;
  genres: string[];
  durationMin: number;
  languages: string[];
  certification: string;
  rating: number;            // 0–10
  ratingSource: string;      // e.g. "CineVerse audience"
  votes: number;
  releaseDate: string;       // ISO date
  status: MovieStatus;
  formats: ScreenFormat[];
  director: string;
  cast: Person[];
  crew: Person[];
  posterUrl?: string | null;
  backdropUrl?: string | null;
  trailerUrl?: string | null; // YouTube or MP4
  palette: [string, string, string];
  motif: Motif;
  trending: number;          // 0–100
  createdAt: string;
}

export interface City { id: string; name: string; state: string; lat: number; lng: number; areas: { name: string; lat: number; lng: number }[] }

export interface Theatre {
  id: string;
  name: string;
  brand: string;
  cityId: string;
  area: string;
  address: string;
  lat: number;
  lng: number;
  rating: number;
  facilities: string[];
  cancellationHours: number; // cancellations allowed until N hours before show
}

export type SeatKind = 'standard' | 'premium' | 'recliner' | 'vip';

export interface SeatCategory {
  id: string;
  name: string;
  kind: SeatKind;
  price: number; // INR, exclusive of GST
}

/** A cell in a row: a seat, or an aisle gap that occupies one seat width. */
export type RowCell =
  | { t: 's'; n: number; acc?: boolean } // seat number, accessible
  | { t: 'g' };                           // gap / aisle

export interface LayoutRow {
  label: string;
  categoryId: string;
  cells: RowCell[];
  walkwayAfter?: boolean; // cross-aisle behind this row
}

export interface ScreenGeometry {
  screenWidthM: number;
  screenHeightM: number;
  screenElevationM: number;   // bottom edge of screen above front floor
  firstRowDistanceM: number;  // screen plane → first row eye position
  rowSpacingM: number;
  seatWidthM: number;
  rakeM: number;              // riser height per row
  curvature: number;          // 0 = straight rows; >0 curves rows toward screen
  walkwayDepthM: number;
}

export interface SeatLayout {
  rows: LayoutRow[];          // rows[0] = front row (closest to screen)
  categories: SeatCategory[];
  geometry: ScreenGeometry;
  exits: { side: 'left' | 'right' | 'rear'; rowIndex: number }[];
}

export interface Screen {
  id: string;
  theatreId: string;
  name: string;
  formats: ScreenFormat[];
  layout: SeatLayout;
}

export interface Show {
  id: string;
  movieId: string;
  screenId: string;
  startsAt: string; // ISO datetime
  language: string;
  format: ScreenFormat;
  priceFactor: number;         // multiplier on category prices (e.g. weekend 1.15)
  soldOffline: string[];       // seat ids sold at the box office (seeded occupancy)
  cancelled?: boolean;
}

export type BookingStatus = 'pending' | 'confirmed' | 'failed' | 'expired' | 'cancelled';

export interface PriceLine { seatId: string; categoryId: string; categoryName: string; price: number }
export interface PriceBreakdown {
  lines: PriceLine[];
  subtotal: number;
  convenienceFee: number;
  gstOnTickets: number;
  gstOnFee: number;
  total: number;
}

export interface Booking {
  id: string;
  code: string;               // human booking ID e.g. CV-7KQ2-91XA
  userId: string;
  holderId: string;
  showId: string;
  seatIds: string[];
  pricing: PriceBreakdown;
  status: BookingStatus;
  createdAt: string;
  expiresAt: string;          // pending bookings expire with the seat hold
  confirmedAt?: string;
  cancelledAt?: string;
  paymentId?: string;
  refund?: { status: 'initiated' | 'processed' | 'failed'; amount: number; refId?: string; at: string };
}

export type PaymentStatus = 'created' | 'captured' | 'failed' | 'refunded';
export interface Payment {
  id: string;
  bookingId: string;
  provider: 'razorpay' | 'sandbox';
  orderId: string;
  providerPaymentId?: string;
  amount: number;             // paise
  currency: 'INR';
  status: PaymentStatus;
  method?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export type Role = 'user' | 'admin';
export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash?: string;
  role: Role;
  provider: 'credentials' | 'google';
  image?: string | null;
  favourites: string[];        // movie ids
  paymentPreference?: { method: 'upi' | 'card' | 'netbanking' | 'wallet'; label: string; token?: string } | null;
  createdAt: string;
}

export interface Panorama {
  id: string;
  screenId: string;
  url: string;
  projection: '180' | '360';
  /** Seat zone this photograph represents. Empty arrays mean "any". */
  zone: { rows: string[]; side: 'left' | 'centre' | 'right' | 'any' };
  /** Yaw (deg) in the image that faces the screen centre. */
  yawOffsetDeg: number;
  capturedAt: string;
  label: string;
  createdAt: string;
}

export interface Review { id: string; movieId: string; userId: string; userName: string; rating: number; text: string; createdAt: string }

// ─── Live seat state ──────────────────────────────────────────────────────────
export type SeatState = 'available' | 'occupied' | 'held' | 'mine';
export interface SeatStateMap { [seatId: string]: SeatState }
