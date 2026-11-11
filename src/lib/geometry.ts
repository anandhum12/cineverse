import type { SeatLayout, LayoutRow, SeatCategory, ScreenGeometry } from './types';

/**
 * Theatre coordinate system (metres):
 *   origin = centre of the screen's bottom edge projected onto the front floor
 *   +x = audience's right, +y = up, +z = away from the screen toward the rear wall
 * The audience faces −z.
 */
export interface SeatGeo {
  id: string;           // e.g. "F12"
  row: string;
  rowIndex: number;     // 0 = front
  number: number;
  col: number;          // cell index inside the row (gaps included)
  categoryId: string;
  accessible: boolean;
  x: number;
  z: number;
  floorY: number;
  eyeY: number;
  yaw: number;          // rotation so the seat faces the screen centre (radians)
}

export interface ViewMetrics {
  distanceM: number;          // eye → screen centre
  horizontalOffsetDeg: number;// + = right of centre line
  subtendedDeg: number;       // horizontal field of view filled by the screen
  verticalDeg: number;        // look-up angle to screen centre
  topElevationDeg: number;    // look-up angle to the top edge (neck strain)
  apparentScale: number;      // apparent screen width vs. reference seat (36° FOV)
  score: number;              // 0–100
  quality: 'Excellent' | 'Great' | 'Good' | 'Fair' | 'Limited';
}

const SEATED_EYE = 1.15;
const RECLINER_EYE = 1.0;

export function seatId(row: string, n: number) {
  return `${row}${n}`;
}

export function computeSeats(layout: SeatLayout): SeatGeo[] {
  const g = layout.geometry;
  const out: SeatGeo[] = [];
  let z = g.firstRowDistanceM;
  let floor = 0;
  const kindOf = new Map(layout.categories.map((c) => [c.id, c.kind]));

  layout.rows.forEach((row, ri) => {
    const isRecliner = kindOf.get(row.categoryId) === 'recliner' || kindOf.get(row.categoryId) === 'vip';
    const rowDepth = isRecliner ? g.rowSpacingM * 1.45 : g.rowSpacingM;
    if (ri > 0) {
      const prev = layout.rows[ri - 1];
      const prevRecliner = kindOf.get(prev.categoryId) === 'recliner' || kindOf.get(prev.categoryId) === 'vip';
      z += ((prevRecliner ? g.rowSpacingM * 1.45 : g.rowSpacingM) + rowDepth) / 2;
      if (prev.walkwayAfter) z += g.walkwayDepthM;
      floor += g.rakeM;
    }
    const width = isRecliner ? g.seatWidthM * 1.5 : g.seatWidthM;
    const span = row.cells.length * width;
    row.cells.forEach((cell, ci) => {
      if (cell.t !== 's') return;
      const x = -span / 2 + width * (ci + 0.5);
      const zc = z - g.curvature * x * x;
      out.push({
        id: seatId(row.label, cell.n),
        row: row.label,
        rowIndex: ri,
        number: cell.n,
        col: ci,
        categoryId: row.categoryId,
        accessible: !!cell.acc,
        x,
        z: zc,
        floorY: floor,
        eyeY: floor + (isRecliner ? RECLINER_EYE : SEATED_EYE),
        yaw: Math.atan2(x, zc + 6),
      });
    });
  });
  return out;
}

const deg = (r: number) => (r * 180) / Math.PI;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function viewMetrics(seat: Pick<SeatGeo, 'x' | 'z' | 'eyeY'>, g: ScreenGeometry): ViewMetrics {
  const cy = g.screenElevationM + g.screenHeightM / 2;
  const top = g.screenElevationM + g.screenHeightM;
  const dy = cy - seat.eyeY;
  const distanceM = Math.sqrt(seat.x ** 2 + seat.z ** 2 + dy ** 2);
  const horizontalOffsetDeg = deg(Math.atan2(seat.x, seat.z));

  // angle between rays to the left & right screen edges (in plan view)
  const lx = -g.screenWidthM / 2 - seat.x;
  const rx = g.screenWidthM / 2 - seat.x;
  const a1 = Math.atan2(lx, seat.z);
  const a2 = Math.atan2(rx, seat.z);
  const subtendedDeg = deg(a2 - a1);
  const verticalDeg = deg(Math.atan2(dy, seat.z));
  const topElevationDeg = deg(Math.atan2(top - seat.eyeY, seat.z));

  // THX/SMPTE-inspired scoring: immersive band 34–52° horizontal FOV, near-on-axis, low neck strain
  const fov = subtendedDeg < 34 ? clamp01((subtendedDeg - 16) / 18) : subtendedDeg > 52 ? clamp01(1 - (subtendedDeg - 52) / 30) : 1;
  const axis = Math.abs(horizontalOffsetDeg) <= 7 ? 1 : clamp01(1 - (Math.abs(horizontalOffsetDeg) - 7) / 30);
  const neck = topElevationDeg <= 24 ? 1 : clamp01(1 - (topElevationDeg - 24) / 24);
  const score = Math.round(100 * (0.5 * fov + 0.3 * axis + 0.2 * neck));
  const quality = score >= 86 ? 'Excellent' : score >= 72 ? 'Great' : score >= 56 ? 'Good' : score >= 40 ? 'Fair' : 'Limited';
  return { distanceM, horizontalOffsetDeg, subtendedDeg, verticalDeg, topElevationDeg, apparentScale: subtendedDeg / 36, score, quality };
}

export function roomBounds(layout: SeatLayout, seats = computeSeats(layout)) {
  const g = layout.geometry;
  const xs = seats.map((s) => Math.abs(s.x));
  const halfSpan = Math.max(g.screenWidthM / 2 + 1.5, (xs.length ? Math.max(...xs) : 6) + 2.4);
  const maxZ = seats.length ? Math.max(...seats.map((s) => s.z)) : 12;
  const maxFloor = seats.length ? Math.max(...seats.map((s) => s.floorY)) : 0;
  return {
    halfWidth: halfSpan,
    depth: maxZ + 2.6,
    height: Math.max(g.screenElevationM + g.screenHeightM + 2.2, maxFloor + 4.2),
    maxFloor,
  };
}

export function categoryFor(layout: SeatLayout, id: string): SeatCategory | undefined {
  return layout.categories.find((c) => c.id === id);
}

// ─── Layout helpers used by seeds and the admin layout editor ────────────────
export function makeRow(label: string, categoryId: string, seats: number, aisles: number[] = [], opts: { accessible?: number[]; walkwayAfter?: boolean } = {}): LayoutRow {
  const cells: LayoutRow['cells'] = [];
  for (let n = 1; n <= seats; n++) {
    cells.push({ t: 's', n, ...(opts.accessible?.includes(n) ? { acc: true } : {}) });
    if (aisles.includes(n)) cells.push({ t: 'g' });
  }
  return { label, categoryId, cells, ...(opts.walkwayAfter ? { walkwayAfter: true } : {}) };
}

export function rowLabel(i: number) {
  // A..Z, AA..AZ
  return i < 26 ? String.fromCharCode(65 + i) : 'A' + String.fromCharCode(65 + (i - 26));
}

export function validateLayout(layout: SeatLayout): string[] {
  const errs: string[] = [];
  const labels = new Set<string>();
  const cats = new Set(layout.categories.map((c) => c.id));
  if (!layout.rows.length) errs.push('Layout needs at least one row.');
  for (const r of layout.rows) {
    if (!/^[A-Z]{1,2}$/.test(r.label)) errs.push(`Row label "${r.label}" must be 1–2 capital letters.`);
    if (labels.has(r.label)) errs.push(`Duplicate row label ${r.label}.`);
    labels.add(r.label);
    if (!cats.has(r.categoryId)) errs.push(`Row ${r.label} uses an unknown category.`);
    const nums = r.cells.filter((c) => c.t === 's').map((c) => (c as { n: number }).n);
    if (new Set(nums).size !== nums.length) errs.push(`Row ${r.label} has duplicate seat numbers.`);
    if (r.cells.length > 60) errs.push(`Row ${r.label} is too wide (max 60 cells).`);
  }
  const g = layout.geometry;
  if (g.screenWidthM < 4 || g.screenWidthM > 40) errs.push('Screen width must be 4–40 m.');
  if (g.screenHeightM < 2 || g.screenHeightM > 30) errs.push('Screen height must be 2–30 m.');
  if (g.firstRowDistanceM < 2) errs.push('First row must be at least 2 m from the screen.');
  if (g.rowSpacingM < 0.8 || g.rowSpacingM > 2.5) errs.push('Row spacing must be 0.8–2.5 m.');
  if (g.seatWidthM < 0.45 || g.seatWidthM > 1) errs.push('Seat width must be 0.45–1 m.');
  for (const c of layout.categories) if (!(c.price > 0)) errs.push(`Category ${c.name} needs a positive price.`);
  return errs;
}
