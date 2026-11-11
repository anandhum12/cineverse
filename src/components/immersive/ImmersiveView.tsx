'use client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { motion } from 'framer-motion';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type * as THREE from 'three';
import type { Movie, Panorama, SeatLayout, SeatStateMap, Show } from '@/lib/types';
import { computeSeats, viewMetrics, type SeatGeo } from '@/lib/geometry';
import { seatPrice } from '@/lib/pricing';
import { cx, inr } from '@/lib/format';
import { TheatreScene, PanoramaSphere, type LookState } from './TheatreScene';
import { LiteView } from './LiteView';
import { SeatMap } from '../booking/SeatMap';

const HALF = Math.PI / 2; // ±90° → 180° field to explore
const DEG = Math.PI / 180;

function webglOK() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}
function lowPower() {
  const n = navigator as Navigator & { deviceMemory?: number };
  return (n.hardwareConcurrency ?? 8) <= 4 || (n.deviceMemory ?? 8) <= 3;
}

/** Find an uploaded real photograph for this seat's zone (row + side). */
export function panoramaFor(panos: Panorama[], seat: SeatGeo, horizontalOffsetDeg: number) {
  const side = horizontalOffsetDeg < -8 ? 'left' : horizontalOffsetDeg > 8 ? 'right' : 'centre';
  const score = (p: Panorama) => (p.zone.rows.length ? (p.zone.rows.includes(seat.row) ? 2 : -99) : 0) + (p.zone.side === 'any' ? 0 : p.zone.side === side ? 1 : -99);
  return panos.map((p) => ({ p, s: score(p) })).filter((x) => x.s >= 0).sort((a, b) => b.s - a.s)[0]?.p ?? null;
}

interface Props {
  layout: SeatLayout;
  show: Pick<Show, 'priceFactor'>;
  movie: Pick<Movie, 'title' | 'palette' | 'tagline'>;
  states: SeatStateMap;
  selected: string[];
  seatId: string;
  panoramas: Panorama[];
  origin: { x: number; y: number };
  onSeatChange: (id: string) => void;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export default function ImmersiveView({ layout, show, movie, states, selected, seatId, panoramas, origin, onSeatChange, onSelect, onClose }: Props) {
  const seats = useMemo(() => computeSeats(layout), [layout]);
  const seat = seats.find((s) => s.id === seatId) ?? seats[0];
  const metrics = useMemo(() => viewMetrics(seat, layout.geometry), [seat, layout.geometry]);
  const cat = layout.categories.find((c) => c.id === seat.categoryId)!;
  const pano = panoramaFor(panoramas, seat, metrics.horizontalOffsetDeg);
  const [mode, setMode] = useState<'real' | 'sim' | 'lite'>(() => 'sim');
  const [canGL] = useState(() => (typeof window === 'undefined' ? true : webglOK()));
  const [quality] = useState<'high' | 'low'>(() => (typeof window !== 'undefined' && lowPower() ? 'low' : 'high'));
  const [gyro, setGyro] = useState(false);
  const [vr, setVr] = useState<{ supported: boolean; active: boolean }>({ supported: false, active: false });
  const [showMap, setShowMap] = useState(false);
  const [hint, setHint] = useState(true);
  const glRef = useRef<THREE.WebGLRenderer | null>(null);

  useEffect(() => { if (!canGL) setMode('lite'); }, [canGL]);
  useEffect(() => { if (pano && mode === 'sim') setMode('real'); else if (!pano && mode === 'real') setMode('sim'); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pano?.id]);

  // base orientation faces the screen centre; user explores ±90° around it
  const baseYaw = Math.atan2(seat.x, seat.z);
  const basePitch = Math.atan2(layout.geometry.screenElevationM + layout.geometry.screenHeightM / 2 - seat.eyeY, Math.hypot(seat.x, seat.z));
  const look = useRef<LookState>({ yaw: baseYaw, pitch: basePitch, fov: 62 });
  const offset = useRef({ yaw: 0, pitch: 0 });
  const [, force] = useState(0);
  const apply = useCallback(() => {
    offset.current.yaw = Math.max(-HALF, Math.min(HALF, offset.current.yaw));
    offset.current.pitch = Math.max(-40 * DEG, Math.min(50 * DEG, offset.current.pitch));
    look.current.yaw = baseYaw + offset.current.yaw;
    look.current.pitch = basePitch + offset.current.pitch;
  }, [baseYaw, basePitch]);
  useEffect(() => { offset.current = { yaw: 0, pitch: 0 }; apply(); }, [seatId, apply]);

  // ── drag / touch / wheel / keys ──
  const drag = useRef<{ x: number; y: number; id: number } | null>(null);
  const pinch = useRef<{ d: number; fov: number } | null>(null);
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const onDown = (e: React.PointerEvent) => {
    setHint(false);
    touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    if (touches.current.size === 2) { const [a, b] = [...touches.current.values()]; pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), fov: look.current.fov }; drag.current = null; }
    else drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onMove = (e: React.PointerEvent) => {
    if (!touches.current.has(e.pointerId)) return;
    touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && touches.current.size === 2) {
      const [a, b] = [...touches.current.values()];
      look.current.fov = Math.max(28, Math.min(90, pinch.current.fov * (pinch.current.d / Math.hypot(a.x - b.x, a.y - b.y))));
      return;
    }
    const d = drag.current; if (!d || d.id !== e.pointerId || gyro) return;
    const k = (look.current.fov / 62) * 0.0042;
    offset.current.yaw += (e.clientX - d.x) * k;
    offset.current.pitch += (e.clientY - d.y) * k;
    d.x = e.clientX; d.y = e.clientY; apply();
  };
  const onUp = (e: React.PointerEvent) => { touches.current.delete(e.pointerId); if (touches.current.size < 2) pinch.current = null; if (!touches.current.size) drag.current = null; };
  const onWheel = (e: React.WheelEvent) => { look.current.fov = Math.max(28, Math.min(90, look.current.fov + e.deltaY * 0.03)); setHint(false); };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      const step = 6 * DEG;
      if (e.key === 'ArrowLeft') offset.current.yaw += step;
      if (e.key === 'ArrowRight') offset.current.yaw -= step;
      if (e.key === 'ArrowUp') offset.current.pitch += step;
      if (e.key === 'ArrowDown') offset.current.pitch -= step;
      if (e.key === '+' || e.key === '=') look.current.fov = Math.max(28, look.current.fov - 5);
      if (e.key === '-') look.current.fov = Math.min(90, look.current.fov + 5);
      apply();
    };
    addEventListener('keydown', k);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { removeEventListener('keydown', k); document.body.style.overflow = prev; };
  }, [apply, onClose]);

  // ── gyroscope ──
  const gyroBase = useRef<{ a: number; b: number } | null>(null);
  useEffect(() => {
    if (!gyro) return;
    gyroBase.current = null;
    const h = (e: DeviceOrientationEvent) => {
      if (e.alpha == null || e.beta == null) return;
      const portrait = matchMedia('(orientation: portrait)').matches;
      const tilt = portrait ? e.beta : Math.abs(e.gamma ?? 90);
      if (!gyroBase.current) gyroBase.current = { a: e.alpha, b: tilt };
      let da = e.alpha - gyroBase.current.a; if (da > 180) da -= 360; if (da < -180) da += 360;
      offset.current.yaw = da * DEG;
      offset.current.pitch = (tilt - gyroBase.current.b) * DEG;
      apply();
    };
    addEventListener('deviceorientation', h);
    return () => removeEventListener('deviceorientation', h);
  }, [gyro, apply]);
  const hasGyro = typeof window !== 'undefined' && 'DeviceOrientationEvent' in window && matchMedia('(pointer: coarse)').matches;
  const toggleGyro = async () => {
    if (gyro) return setGyro(false);
    const D = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    if (D.requestPermission) { try { if ((await D.requestPermission()) !== 'granted') return; } catch { return; } }
    setGyro(true); setHint(false);
  };

  // ── WebXR ──
  useEffect(() => {
    const xr = (navigator as Navigator & { xr?: { isSessionSupported: (m: string) => Promise<boolean> } }).xr;
    xr?.isSessionSupported('immersive-vr').then((ok) => setVr((v) => ({ ...v, supported: ok }))).catch(() => {});
  }, []);
  const enterVR = async () => {
    const xr = (navigator as Navigator & { xr?: { requestSession: (m: string, o: object) => Promise<XRSessionLike> } }).xr;
    const gl = glRef.current; if (!xr || !gl) return;
    try {
      const session = await xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] });
      gl.xr.setReferenceSpaceType('local');
      await gl.xr.setSession(session as unknown as XRSession);
      setVr((v) => ({ ...v, active: true }));
      session.addEventListener('end', () => setVr((v) => ({ ...v, active: false })));
    } catch { /* user cancelled */ }
  };

  const price = seatPrice(layout, show, cat.id);
  const isSelected = selected.includes(seat.id);
  const st = states[seat.id] ?? 'available';
  const qualityTone = metrics.score >= 72 ? 'text-emerald-300 bg-emerald-400/10' : metrics.score >= 56 ? 'text-sky-300 bg-sky-400/10' : 'text-amber-300 bg-amber-400/10';
  const r = typeof window !== 'undefined' ? Math.hypot(Math.max(origin.x, innerWidth - origin.x), Math.max(origin.y, innerHeight - origin.y)) : 2000;

  return (
    <motion.div className="fixed inset-0 z-[95] bg-black" role="dialog" aria-modal="true" aria-label={`180 degree view from seat ${seat.id}`}
      initial={{ clipPath: `circle(0px at ${origin.x}px ${origin.y}px)` }} animate={{ clipPath: `circle(${r}px at ${origin.x}px ${origin.y}px)` }} exit={{ clipPath: `circle(0px at ${origin.x}px ${origin.y}px)`, transition: { duration: 0.45, ease: [0.65, 0, 0.35, 1] } }}
      transition={{ duration: 0.85, ease: [0.65, 0, 0.35, 1] }}>
      <div className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel}>
        {mode === 'lite' ? (
          <LiteView layout={layout} seat={seat} states={states} look={look} movie={movie} />
        ) : (
          <Canvas dpr={quality === 'high' ? [1, 1.75] : [0.75, 1.25]} gl={{ antialias: quality === 'high', powerPreference: 'high-performance' }}
            camera={{ position: [0, 0, 0], fov: 62, near: 0.05, far: 400 }}
            onCreated={({ gl }) => { gl.xr.enabled = true; glRef.current = gl; }}>
            <Suspense fallback={null}>
              {mode === 'real' && pano ? <><color attach="background" args={['#000']} /><PanoramaSphere url={pano.url} projection={pano.projection} yawOffsetDeg={pano.yawOffsetDeg} /><LookOnly look={look} baseYaw={baseYaw} /></>
                : <TheatreScene layout={layout} movie={movie} states={states} selected={selected} seat={seat} look={look} quality={quality} />}
            </Suspense>
          </Canvas>
        )}
      </div>

      {/* vignette */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,.65))]" />

      {/* top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4 sm:p-6">
        <div className="pointer-events-auto">
          {mode === 'real' && pano ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-200 backdrop-blur">● Real photograph · {pano.label} · captured {new Date(pano.capturedAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-400/15 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-100 backdrop-blur sm:text-[11px]">◇ Simulated preview: computed from theatre geometry, not a photograph</span>
          )}
        </div>
        <button onClick={onClose} className="pointer-events-auto glass-strong grid h-11 w-11 shrink-0 place-items-center rounded-full text-lg focus-ring" aria-label="Close preview">✕</button>
      </div>

      {hint && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <motion.div animate={{ x: [-24, 24, -24] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }} className="mx-auto mb-3 h-12 w-12 rounded-full border-2 border-white/70 bg-white/10 backdrop-blur" />
          <p className="rounded-full bg-black/50 px-4 py-2 text-sm text-white/85 backdrop-blur">Drag to look around · scroll or pinch to zoom</p>
        </motion.div>
      )}

      {/* HUD */}
      <div className="absolute inset-x-0 bottom-0 p-3 sm:p-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 lg:flex-row lg:items-end">
          <div className="glass-strong flex-1 rounded-3xl p-3.5 sm:p-5">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <p className="eyebrow">Your seat</p>
                <p className="font-display text-2xl font-bold leading-none sm:text-3xl">{seat.id}</p>
              </div>
              <div className="h-10 w-px bg-white/10" />
              <div className="text-sm"><p className="text-white/50">Row {seat.row} · Seat {seat.number}</p><p className="font-semibold">{cat.name} · {inr(price)}</p></div>
              <span className={cx('ml-auto rounded-full px-3 py-1 text-xs font-semibold', qualityTone)}>{metrics.quality} view · {metrics.score}/100</span>
            </div>
            <p className="mt-2 text-xs text-white/60 sm:hidden">{metrics.distanceM.toFixed(1)} m away · screen fills {Math.round(metrics.subtendedDeg)}° · {Math.abs(metrics.horizontalOffsetDeg).toFixed(0)}° {metrics.horizontalOffsetDeg > 1 ? 'right' : metrics.horizontalOffsetDeg < -1 ? 'left' : 'centre'} · look-up {Math.round(metrics.topElevationDeg)}°</p>
            <dl className="mt-4 hidden grid-cols-2 gap-3 text-xs sm:grid sm:grid-cols-4">
              <Metric k="Distance to screen" v={`${metrics.distanceM.toFixed(1)} m`} />
              <Metric k="Screen fills" v={`${Math.round(metrics.subtendedDeg)}° of view`} sub={metrics.apparentScale > 1.15 ? 'Larger than reference' : metrics.apparentScale < 0.85 ? 'Smaller than reference' : 'Reference size'} />
              <Metric k="Viewing angle" v={`${Math.abs(metrics.horizontalOffsetDeg).toFixed(0)}° ${metrics.horizontalOffsetDeg > 1 ? 'right' : metrics.horizontalOffsetDeg < -1 ? 'left' : 'centre'}`} />
              <Metric k="Look-up to top edge" v={`${Math.round(metrics.topElevationDeg)}°`} sub={metrics.topElevationDeg > 30 ? 'Some neck tilt' : 'Comfortable'} />
            </dl>
          </div>
          <div className="glass-strong flex flex-col gap-2 rounded-3xl p-2.5 sm:p-3 lg:items-stretch">
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto sm:flex-wrap">
              {pano && <button onClick={() => setMode(mode === 'real' ? 'sim' : 'real')} className="chip h-9 shrink-0 focus-ring">{mode === 'real' ? '3D simulation' : 'Real photo'}</button>}
              {canGL && <button onClick={() => setMode(mode === 'lite' ? (pano ? 'real' : 'sim') : 'lite')} className="chip h-9 shrink-0 focus-ring">{mode === 'lite' ? '3D view' : 'Lite view'}</button>}
              {hasGyro && <button onClick={toggleGyro} className={cx('chip h-9 shrink-0 focus-ring', gyro && 'border-neon-violet bg-neon-violet/25 text-white')}>Gyro {gyro ? 'on' : 'off'}</button>}
              {vr.supported && mode !== 'lite' && <button onClick={enterVR} className="chip h-9 shrink-0 focus-ring">Enter VR</button>}
              <button onClick={() => setShowMap((v) => !v)} className={cx('chip h-9 shrink-0 focus-ring', showMap && 'border-neon-violet bg-neon-violet/25 text-white')}>Try another seat</button>
              <button onClick={() => { offset.current = { yaw: 0, pitch: 0 }; look.current.fov = 62; apply(); force((x) => x + 1); }} className="chip h-9 shrink-0 focus-ring">Recentre</button>
            </div>
            {st === 'occupied' || st === 'held' ? (
              <p className="px-2 text-xs text-white/50">This seat is {st === 'held' ? 'on hold' : 'sold'} — preview only.</p>
            ) : (
              <button onClick={() => onSelect(seat.id)} className="h-11 w-full rounded-full bg-neon-gradient sm:h-12 px-6 text-sm font-bold shadow-glow transition hover:shadow-[0_0_60px_-6px_rgba(139,92,246,.8)] focus-ring lg:flex-none">
                {isSelected ? 'Keep this seat' : 'Select this seat'}
              </button>
            )}
          </div>
        </div>
      </div>

      {showMap && (
        <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} className="glass-strong absolute right-3 top-20 h-[42vh] w-[min(92vw,420px)] overflow-hidden rounded-3xl sm:right-6">
          <p className="absolute left-4 top-3 z-10 text-xs text-white/60">Tap any seat to move there</p>
          <SeatMap layout={layout} show={show} states={states} selected={selected} focused={seat.id} compact className="h-full w-full pt-6"
            onSeat={(s) => { onSeatChange(s.id); setHint(false); }} />
        </motion.div>
      )}
    </motion.div>
  );
}

type XRSessionLike = { addEventListener: (t: 'end', f: () => void) => void };

function Metric({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return <div className="rounded-2xl bg-white/[0.04] p-3"><dt className="text-white/45">{k}</dt><dd className="mt-1 font-display text-base font-semibold text-white">{v}</dd>{sub && <dd className="text-[10px] text-white/40">{sub}</dd>}</div>;
}

/** Photo mode: the photograph's forward (−z, plus its yaw offset) faces the screen, so yaw is relative to the seat's base. */
function LookOnly({ look, baseYaw }: { look: React.MutableRefObject<LookState>; baseYaw: number }) {
  const { camera } = useThree();
  useFrame((_, dt) => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.rotation.order = 'YXZ';
    cam.rotation.y += (look.current.yaw - baseYaw - cam.rotation.y) * Math.min(1, dt * 10);
    cam.rotation.x += (look.current.pitch - cam.rotation.x) * Math.min(1, dt * 10);
    if (Math.abs(cam.fov - look.current.fov) > 0.05) { cam.fov += (look.current.fov - cam.fov) * Math.min(1, dt * 8); cam.updateProjectionMatrix(); }
  });
  return null;
}
