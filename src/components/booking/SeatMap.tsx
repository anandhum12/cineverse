'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SeatLayout, SeatStateMap, Show } from '@/lib/types';
import { computeSeats, viewMetrics, type SeatGeo } from '@/lib/geometry';
import { seatPrice } from '@/lib/pricing';
import { cx, inr } from '@/lib/format';

export const SEAT_COLORS: Record<string, string> = { standard: '#4a5675', premium: '#f2c14e', recliner: '#38d9a9', vip: '#ff5fa2' };
const PX = 46; // svg units per metre

interface Props {
  layout: SeatLayout;
  show?: Pick<Show, 'priceFactor'>;
  states: SeatStateMap;
  selected: string[];
  highlight?: string[];
  focused?: string | null;
  onSeat?: (seat: SeatGeo, origin: { x: number; y: number }) => void;
  readOnly?: boolean;
  compact?: boolean;
  className?: string;
}

export function SeatMap({ layout, show = { priceFactor: 1 }, states, selected, highlight = [], focused, onSeat, readOnly, compact, className }: Props) {
  const seats = useMemo(() => computeSeats(layout), [layout]);
  const kind = useMemo(() => new Map(layout.categories.map((c) => [c.id, c])), [layout]);
  const g = layout.geometry;

  // world → svg
  const bounds = useMemo(() => {
    const xs = seats.map((s) => s.x), zs = seats.map((s) => s.z);
    const halfW = Math.max(g.screenWidthM / 2, ...xs.map(Math.abs)) + 1.6;
    return { minX: -halfW * PX, w: halfW * 2 * PX, minY: -2.2 * PX, h: (Math.max(...zs) + 1.6 + 2.2) * PX };
  }, [seats, g]);

  // ── pan / zoom state ──
  const wrap = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean; pinch?: { d: number; k: number } } | null>(null);
  const clampK = (k: number) => Math.max(0.7, Math.min(compact ? 3 : 4.5, k));

  const zoomAt = useCallback((factor: number, cx?: number, cy?: number) => {
    setView((v) => {
      const r = wrap.current?.getBoundingClientRect();
      const px = cx ?? (r ? r.width / 2 : 0), py = cy ?? (r ? r.height / 2 : 0);
      const k = clampK(v.k * factor);
      const f = k / v.k;
      return { k, x: px - (px - v.x) * f, y: py - (py - v.y) * f };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compact]);

  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey && Math.abs(e.deltaY) < 4) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0022), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      drag.current = { ...(drag.current ?? { x: 0, y: 0, vx: view.x, vy: view.y }), moved: true, pinch: { d: Math.hypot(a.x - b.x, a.y - b.y), k: view.k } };
    } else drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return updateHover(e);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const d = drag.current; if (!d) return;
    if (d.pinch && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const r = wrap.current!.getBoundingClientRect();
      const nd = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top;
      setView((v) => { const k = clampK((d.pinch!.k * nd) / d.pinch!.d); const f = k / v.k; return { k, x: mx - (mx - v.x) * f, y: my - (my - v.y) * f }; });
      return;
    }
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) > 6) { d.moved = true; (e.target as Element).setPointerCapture?.(e.pointerId); }
    if (d.moved) { setView((v) => ({ ...v, x: d.vx + dx, y: d.vy + dy })); setHover(null); }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) setTimeout(() => (drag.current = null), 0);
  };

  // ── hover tooltip ──
  const [hover, setHover] = useState<{ seat: SeatGeo; x: number; y: number } | null>(null);
  const updateHover = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const id = (e.target as Element).closest('[data-seat]')?.getAttribute('data-seat');
    if (!id) return setHover(null);
    const seat = seats.find((s) => s.id === id)!;
    const r = wrap.current!.getBoundingClientRect();
    setHover({ seat, x: e.clientX - r.left, y: e.clientY - r.top });
  };

  const click = (s: SeatGeo, e: React.MouseEvent | React.KeyboardEvent) => {
    if (readOnly || drag.current?.moved) return;
    const st = states[s.id] ?? 'available';
    if (st === 'occupied' || st === 'held') return;
    const r = (e.currentTarget as Element).getBoundingClientRect();
    onSeat?.(s, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
  };

  const sel = useMemo(() => new Set(selected), [selected]);
  const hi = useMemo(() => new Set(highlight), [highlight]);

  // ── geometry for the drawing ──
  const screenHalf = (g.screenWidthM / 2) * PX;
  const rowsMeta = useMemo(() => {
    const m = new Map<number, { label: string; minX: number; maxX: number; z: number }>();
    for (const s of seats) {
      const r = m.get(s.rowIndex) ?? { label: s.row, minX: Infinity, maxX: -Infinity, z: s.z };
      r.minX = Math.min(r.minX, s.x); r.maxX = Math.max(r.maxX, s.x); r.z = Math.max(r.z, s.z);
      m.set(s.rowIndex, r);
    }
    return [...m.values()];
  }, [seats]);
  const walkways = layout.rows.map((r, i) => (r.walkwayAfter ? i : -1)).filter((i) => i >= 0).map((i) => {
    const a = rowsMeta[i]?.z ?? 0, b = rowsMeta[i + 1]?.z ?? a + 2;
    return (a + b) / 2;
  });

  return (
    <div ref={wrap} className={cx('relative touch-none select-none overflow-hidden', className)}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onPointerLeave={() => setHover(null)}>
      <div className="h-full w-full will-change-transform" style={{ transformOrigin: '0 0', transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.k})`, transition: drag.current?.moved ? 'none' : 'transform .25s cubic-bezier(.22,1,.36,1)' }}>
      <svg viewBox={`${bounds.minX} ${bounds.minY} ${bounds.w} ${bounds.h}`} className="h-full w-full" role="group" aria-label="Seat map. Screen at the top.">
        <defs>
          <linearGradient id="scr" x1="0" x2="1"><stop offset="0" stopColor="#4f8cff" stopOpacity=".2" /><stop offset=".5" stopColor="#c4b5fd" /><stop offset="1" stopColor="#4f8cff" stopOpacity=".2" /></linearGradient>
          <radialGradient id="beam" cx=".5" cy="0" r="1"><stop offset="0" stopColor="#8b5cf6" stopOpacity=".28" /><stop offset="1" stopColor="#8b5cf6" stopOpacity="0" /></radialGradient>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <g>
              {/* projection beam + screen */}
              <path d={`M${-screenHalf} 0 L${-screenHalf * 1.6} ${bounds.h * 0.9} L${screenHalf * 1.6} ${bounds.h * 0.9} L${screenHalf} 0 Z`} fill="url(#beam)" />
              <path d={`M${-screenHalf} ${-0.9 * PX} Q 0 ${-1.6 * PX} ${screenHalf} ${-0.9 * PX}`} stroke="url(#scr)" strokeWidth={7} fill="none" strokeLinecap="round" filter="url(#glow)" />
              <text x={0} y={-0.35 * PX} textAnchor="middle" fill="#fff" fillOpacity=".45" fontSize={13} letterSpacing={6}>SCREEN · {g.screenWidthM} m</text>
              {/* walkways */}
              {walkways.map((z, i) => <g key={i}><rect x={bounds.minX + 8} y={z * PX - 9} width={bounds.w - 16} height={18} rx={9} fill="#fff" fillOpacity=".025" /><text x={bounds.minX + 24} y={z * PX + 4} fontSize={9} fill="#fff" fillOpacity=".3" letterSpacing={3}>WALKWAY</text></g>)}
              {/* exits */}
              {layout.exits.map((ex, i) => {
                const rz = rowsMeta[Math.min(ex.rowIndex, rowsMeta.length - 1)]?.z ?? 0;
                const x = ex.side === 'left' ? bounds.minX + 6 : ex.side === 'right' ? bounds.minX + bounds.w - 46 : -20;
                const y = ex.side === 'rear' ? bounds.minY + bounds.h - 22 : rz * PX - 8;
                return <g key={i}><rect x={x} y={y} width={40} height={16} rx={4} fill="#10b981" fillOpacity=".18" stroke="#34d399" strokeOpacity=".6" /><text x={x + 20} y={y + 11.5} textAnchor="middle" fontSize={8.5} fontWeight={700} fill="#6ee7b7">EXIT</text></g>;
              })}
              {/* row labels */}
              {rowsMeta.map((r) => <g key={r.label} fontSize={11} fill="#fff" fillOpacity=".35" fontWeight={600}>
                <text x={(r.minX - 0.9) * PX} y={r.z * PX + 4} textAnchor="middle">{r.label}</text>
                <text x={(r.maxX + 0.9) * PX} y={r.z * PX + 4} textAnchor="middle">{r.label}</text>
              </g>)}
              {/* seats */}
              {seats.map((s) => {
                const cat = kind.get(s.categoryId)!;
                const st = states[s.id] ?? 'available';
                const isSel = sel.has(s.id) || st === 'mine';
                const isHi = hi.has(s.id);
                const lux = cat.kind === 'recliner' || cat.kind === 'vip';
                const w = (lux ? 0.62 : 0.44) * PX, h = (lux ? 0.5 : 0.4) * PX;
                const base = SEAT_COLORS[cat.kind];
                const fill = isSel ? '#8b5cf6' : st === 'occupied' ? '#1b1e2a' : st === 'held' ? '#fb923c' : cat.kind === 'standard' ? '#3a4560' : base;
                const op = st === 'available' && !isSel && cat.kind !== 'standard' ? 0.82 : 1;
                const disabled = st === 'occupied' || st === 'held';
                return (
                  <g key={s.id} data-seat={s.id} transform={`translate(${(s.x * PX).toFixed(2)} ${(s.z * PX).toFixed(2)}) rotate(${((-s.yaw * 180) / Math.PI).toFixed(2)})`}
                    role="button" tabIndex={readOnly || disabled ? -1 : 0} aria-pressed={isSel} aria-disabled={disabled}
                    aria-label={`Seat ${s.id}, ${cat.name}, ${inr(seatPrice(layout, show, cat.id))}, ${disabled ? (st === 'held' ? 'on hold' : 'sold') : isSel ? 'selected' : 'available'}${s.accessible ? ', wheelchair accessible' : ''}`}
                    onClick={(e) => click(s, e)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); click(s, e); } }}
                    className={cx('outline-none [&:focus-visible>rect:first-child]:stroke-white', !readOnly && !disabled && 'cursor-pointer')}>
                    <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={lux ? 7 : 5} fill={fill} fillOpacity={op} stroke={isHi ? '#3ee0ff' : focused === s.id ? '#fff' : 'transparent'} strokeWidth={2.5}
                      style={{ transformBox: 'fill-box', transformOrigin: 'center', transform: isSel ? 'scale(1.14)' : 'scale(1)', transition: 'transform .35s cubic-bezier(.34,1.56,.64,1), fill .25s' }}
                      filter={isSel ? 'url(#glow)' : undefined} />
                    <rect x={-w / 2 + 3} y={h / 2 - 4} width={w - 6} height={3} rx={1.5} fill="#000" fillOpacity=".35" pointerEvents="none" />
                    {st === 'occupied' && <path d={`M${-w / 5} ${-h / 5} L${w / 5} ${h / 5} M${w / 5} ${-h / 5} L${-w / 5} ${h / 5}`} stroke="#fff" strokeOpacity=".18" strokeWidth={1.5} pointerEvents="none" />}
                    {s.accessible && !isSel && st !== 'occupied' && <text y={4} textAnchor="middle" fontSize={11} fill="#0b0d14" pointerEvents="none">♿</text>}
                    {isSel && !compact && <text y={3.5} textAnchor="middle" fontSize={9} fontWeight={700} fill="#fff" pointerEvents="none">{s.number}</text>}
                    {isHi && <circle r={w * 0.85} fill="none" stroke="#3ee0ff" strokeOpacity=".5" className="animate-pulse" pointerEvents="none" />}
                  </g>
                );
              })}
        </g>
      </svg>
      </div>

      {hover && !readOnly && (() => {
        const cat = kind.get(hover.seat.categoryId)!;
        const st = states[hover.seat.id] ?? 'available';
        const m = viewMetrics(hover.seat, g);
        return (
          <div className="pointer-events-none absolute z-20 w-48 -translate-x-1/2 -translate-y-[calc(100%+14px)] rounded-2xl border border-white/10 bg-black/85 p-3 text-xs shadow-2xl backdrop-blur" style={{ left: hover.x, top: hover.y }}>
            <div className="flex items-center justify-between"><b className="font-display text-sm">{hover.seat.id}</b><span className="text-white/60">{cat.name}</span></div>
            <div className="mt-1 flex items-center justify-between"><span className="font-semibold text-white">{inr(seatPrice(layout, show, cat.id))}</span><span className="text-white/50">{st === 'occupied' ? 'Sold' : st === 'held' ? 'On hold' : `${m.quality} view`}</span></div>
            <div className="mt-1 text-white/40">{m.distanceM.toFixed(1)} m · {Math.round(m.subtendedDeg)}° FOV{hover.seat.accessible ? ' · ♿' : ''}</div>
          </div>
        );
      })()}

      {!compact && (
        <div className="absolute bottom-3 right-3 flex flex-col gap-1.5">
          <button onClick={() => zoomAt(1.3)} aria-label="Zoom in" className="glass-strong grid h-9 w-9 place-items-center rounded-full text-lg focus-ring">+</button>
          <button onClick={() => zoomAt(1 / 1.3)} aria-label="Zoom out" className="glass-strong grid h-9 w-9 place-items-center rounded-full text-lg focus-ring">−</button>
          <button onClick={() => setView({ k: 1, x: 0, y: 0 })} aria-label="Reset view" className="glass-strong grid h-9 w-9 place-items-center rounded-full text-[10px] focus-ring">1:1</button>
        </div>
      )}
    </div>
  );
}

export function SeatLegend({ layout }: { layout: SeatLayout }) {
  const items = [
    { c: '#3a4560', l: 'Available' }, { c: '#8b5cf6', l: 'Selected' }, { c: '#1b1e2a', l: 'Sold', b: true }, { c: '#fb923c', l: 'On hold' },
    ...layout.categories.filter((c) => c.kind !== 'standard').map((c) => ({ c: SEAT_COLORS[c.kind], l: c.name })),
  ];
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-white/60" aria-label="Seat legend">
      {items.map((i) => <li key={i.l} className="flex items-center gap-2"><span className={cx('h-3.5 w-4 rounded-[4px]', i.b && 'ring-1 ring-white/15')} style={{ background: i.c }} />{i.l}</li>)}
      <li className="flex items-center gap-2"><span className="text-sm">♿</span>Accessible</li>
      <li className="flex items-center gap-2"><span className="rounded border border-emerald-400/60 px-1 text-[9px] font-bold text-emerald-300">EXIT</span>Exit</li>
    </ul>
  );
}
