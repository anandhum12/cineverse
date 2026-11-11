export const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);

export const runtime = (min: number) => `${Math.floor(min / 60)}h ${min % 60}m`;

export const TZ = 'Asia/Kolkata';
export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ });
export const fmtDate = (iso: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) =>
  new Date(iso).toLocaleDateString('en-IN', { ...opts, timeZone: TZ });
export const fmtLongDate = (iso: string) => fmtDate(iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** YYYY-MM-DD in IST */
export const istDay = (d: Date | string) => new Date(d).toLocaleDateString('en-CA', { timeZone: TZ });

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function timeBucket(iso: string): 'morning' | 'afternoon' | 'evening' | 'night' {
  const h = Number(new Date(iso).toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: TZ }));
  if (h < 12) return 'morning';
  if (h < 16) return 'afternoon';
  if (h < 20) return 'evening';
  return 'night';
}

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
