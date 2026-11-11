'use client';
import { useEffect, useMemo, useRef } from 'react';
import type { Movie, SeatLayout, SeatStateMap } from '@/lib/types';
import { computeSeats, roomBounds, type SeatGeo } from '@/lib/geometry';
import type { LookState } from './TheatreScene';

/**
 * Lightweight fallback for devices without WebGL (or low power): a 2D-canvas pinhole projection of
 * the same theatre geometry, so screen size, angle and the seats in front are still accurate.
 */
export function LiteView({ layout, seat, states, look, movie }: { layout: SeatLayout; seat: SeatGeo; states: SeatStateMap; look: React.MutableRefObject<LookState>; movie: Pick<Movie, 'palette' | 'title'> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const seats = useMemo(() => computeSeats(layout), [layout]);
  const room = useMemo(() => roomBounds(layout, seats), [layout, seats]);

  useEffect(() => {
    const c = ref.current!; const ctx = c.getContext('2d')!;
    const g = layout.geometry;
    let raf = 0; const cur = { ...look.current };
    const ahead = seats.filter((s) => s.id !== seat.id && s.z < seat.z + 0.1);
    const draw = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const W = (c.width = c.clientWidth * dpr), H = (c.height = c.clientHeight * dpr);
      cur.yaw += (look.current.yaw - cur.yaw) * 0.18; cur.pitch += (look.current.pitch - cur.pitch) * 0.18; cur.fov += (look.current.fov - cur.fov) * 0.18;
      const f = (H / 2) / Math.tan((cur.fov * Math.PI) / 360);
      const cy = Math.cos(cur.yaw), sy = Math.sin(cur.yaw), cp = Math.cos(cur.pitch), sp = Math.sin(cur.pitch);
      const proj = (x: number, y: number, z: number): [number, number, number] | null => {
        let X = x - seat.x, Y = y - seat.eyeY, Z = z - seat.z;
        // inverse yaw (around Y) then inverse pitch (around X)
        const x1 = X * cy - Z * sy, z1 = X * sy + Z * cy; X = x1; Z = z1;
        const y2 = Y * cp + Z * sp, z2 = -Y * sp + Z * cp; Y = y2; Z = z2;
        if (Z > -0.05) return null;
        return [W / 2 + (f * X) / -Z, H / 2 - (f * Y) / -Z, -Z];
      };
      const poly = (pts: [number, number, number][], fill: string | CanvasGradient) => {
        const p = pts.map((q) => proj(...q)); if (p.some((q) => !q)) return;
        ctx.beginPath(); p.forEach((q, i) => (i ? ctx.lineTo(q![0], q![1]) : ctx.moveTo(q![0], q![1]))); ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
      };
      ctx.fillStyle = '#030208'; ctx.fillRect(0, 0, W, H);
      const hw = room.halfWidth, d = room.depth, h = room.height;
      poly([[-hw, 0, 0], [hw, 0, 0], [hw, 0, d], [-hw, 0, d]], '#120d1d');
      poly([[-hw, 0, 0], [-hw, h, 0], [-hw, h, d], [-hw, 0, d]], '#0f0b1a');
      poly([[hw, 0, 0], [hw, h, 0], [hw, h, d], [hw, 0, d]], '#0f0b1a');
      poly([[-hw, h, 0], [hw, h, 0], [hw, h, d], [-hw, h, d]], '#07060d');
      poly([[-hw, 0, 0], [hw, 0, 0], [hw, h, 0], [-hw, h, 0]], '#08070e');
      const sx = g.screenWidthM / 2, y0 = g.screenElevationM, y1 = y0 + g.screenHeightM;
      const a = proj(-sx, y1, 0), b = proj(sx, y0, 0);
      const grad = a && b ? ctx.createLinearGradient(a[0], a[1], b[0], b[1]) : '#4f8cff';
      if (typeof grad !== 'string') { grad.addColorStop(0, movie.palette[0]); grad.addColorStop(0.55, movie.palette[1]); grad.addColorStop(1, movie.palette[2]); }
      ctx.shadowColor = movie.palette[1]; ctx.shadowBlur = 60 * dpr;
      poly([[-sx, y0, 0], [sx, y0, 0], [sx, y1, 0], [-sx, y1, 0]], grad);
      ctx.shadowBlur = 0;
      // seats far → near so nearer ones overdraw
      for (const s of [...ahead].sort((p, q) => p.z - q.z)) {
        const w = 0.26, top = s.floorY + 0.95;
        const st = states[s.id];
        poly([[s.x - w, s.floorY + 0.2, s.z + 0.3], [s.x + w, s.floorY + 0.2, s.z + 0.3], [s.x + w, top, s.z + 0.32], [s.x - w, top, s.z + 0.32]], st === 'occupied' || st === 'held' ? '#1a1626' : '#2a2f45');
        if (st === 'occupied' || st === 'held') {
          const hd = proj(s.x, s.eyeY - 0.02, s.z + 0.15);
          if (hd) { ctx.beginPath(); ctx.arc(hd[0], hd[1], (0.11 * f) / hd[2], 0, Math.PI * 2); ctx.fillStyle = '#07070b'; ctx.fill(); }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [layout, seat, seats, states, room, look, movie]);

  return <canvas ref={ref} className="h-full w-full" aria-hidden />;
}
