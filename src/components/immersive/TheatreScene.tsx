'use client';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import type { Movie, SeatLayout, SeatStateMap } from '@/lib/types';
import { computeSeats, roomBounds, type SeatGeo } from '@/lib/geometry';

RectAreaLightUniformsLib.init();

export interface LookState { yaw: number; pitch: number; fov: number }

/** Canvas texture with the film's key-art colours, used as the projected image. */
function useScreenTexture(movie: Pick<Movie, 'title' | 'palette' | 'tagline'>) {
  return useMemo(() => {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 440;
    const x = c.getContext('2d')!;
    const [c1, c2, c3] = movie.palette;
    const g = x.createLinearGradient(0, 0, 1024, 440); g.addColorStop(0, c1); g.addColorStop(0.55, c2); g.addColorStop(1, '#05060a');
    x.fillStyle = g; x.fillRect(0, 0, 1024, 440);
    const r = x.createRadialGradient(700, 180, 10, 700, 180, 260); r.addColorStop(0, '#ffffffcc'); r.addColorStop(0.2, c3); r.addColorStop(1, 'transparent');
    x.fillStyle = r; x.fillRect(0, 0, 1024, 440);
    for (let i = 0; i < 18; i++) { x.strokeStyle = `rgba(255,255,255,${0.03 + i * 0.006})`; x.beginPath(); x.ellipse(700, 180, 80 + i * 22, 18 + i * 6, -0.2, 0, Math.PI * 2); x.stroke(); }
    x.fillStyle = '#fff'; x.font = '800 64px system-ui, sans-serif'; x.textBaseline = 'bottom';
    x.fillText(movie.title.toUpperCase(), 60, 360);
    x.globalAlpha = 0.7; x.font = '500 22px system-ui, sans-serif'; x.fillText(movie.tagline.slice(0, 70), 62, 398);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    return t;
  }, [movie]);
}

function signTexture(text: string, color: string, bg: string) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 96;
  const x = c.getContext('2d')!;
  x.fillStyle = bg; x.fillRect(0, 0, 256, 96); x.fillStyle = color; x.font = '800 54px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 128, 52);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

interface SceneProps {
  layout: SeatLayout;
  movie: Pick<Movie, 'title' | 'palette' | 'tagline'>;
  states: SeatStateMap;
  selected: string[];
  seat: SeatGeo;
  look: React.MutableRefObject<LookState>;
  quality: 'high' | 'low';
}

/**
 * World is offset so the viewer's eye sits at the origin. That keeps both the normal camera and
 * WebXR head pose (which starts at the origin) at the correct seat. Changing seat animates the offset.
 */
export function TheatreScene({ layout, movie, states, selected, seat, look, quality }: SceneProps) {
  const seats = useMemo(() => computeSeats(layout), [layout]);
  const room = useMemo(() => roomBounds(layout, seats), [layout, seats]);
  const g = layout.geometry;
  const screenTex = useScreenTexture(movie);
  const world = useRef<THREE.Group>(null);
  const { camera, gl } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => { target.set(-seat.x, -seat.eyeY, -seat.z); }, [seat, target]);
  useLayoutEffect(() => { world.current?.position.set(-seat.x, -seat.eyeY, -seat.z); /* first frame: no fly-in */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const screenLight = useRef<THREE.RectAreaLight>(null);
  useFrame((state, dt) => {
    if (world.current) world.current.position.lerp(target, 1 - Math.pow(0.0015, dt));
    if (!gl.xr.isPresenting) {
      const cam = camera as THREE.PerspectiveCamera;
      cam.rotation.order = 'YXZ';
      cam.rotation.y += (look.current.yaw - cam.rotation.y) * Math.min(1, dt * 10);
      cam.rotation.x += (look.current.pitch - cam.rotation.x) * Math.min(1, dt * 10);
      if (Math.abs(cam.fov - look.current.fov) > 0.05) { cam.fov += (look.current.fov - cam.fov) * Math.min(1, dt * 8); cam.updateProjectionMatrix(); }
    }
    if (screenLight.current) screenLight.current.intensity = 5.5 + Math.sin(state.clock.elapsedTime * 2.1) * 0.35 + Math.sin(state.clock.elapsedTime * 7.3) * 0.15;
  });

  // ── Seats (instanced) ──
  const sel = useMemo(() => new Set(selected), [selected]);
  const kindOf = useMemo(() => new Map(layout.categories.map((c) => [c.id, c.kind])), [layout]);
  const others = useMemo(() => seats.filter((s) => s.id !== seat.id), [seats, seat.id]);
  const baseRef = useRef<THREE.InstancedMesh>(null);
  const backRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);
  // audience heads; immediate neighbours are omitted so they don't fill the frame when looking sideways
  const occupied = useMemo(() => others.filter((s) => (states[s.id] === 'occupied' || states[s.id] === 'held') && Math.hypot(s.x - seat.x, s.z - seat.z) > 1.1), [others, states, seat]);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    const col = new THREE.Color();
    others.forEach((s, i) => {
      const lux = ['recliner', 'vip'].includes(kindOf.get(s.categoryId)!);
      q.setFromEuler(new THREE.Euler(0, s.yaw, 0));
      sc.set(lux ? 0.82 : 0.5, 1, lux ? 0.85 : 0.55);
      p.set(s.x, s.floorY + 0.22, s.z); m.compose(p, q, sc); baseRef.current!.setMatrixAt(i, m);
      p.set(s.x + Math.sin(s.yaw) * 0.3 * (lux ? 1.4 : 1), s.floorY + (lux ? 0.55 : 0.62), s.z + Math.cos(s.yaw) * 0.3 * (lux ? 1.4 : 1)); sc.set(lux ? 0.82 : 0.5, lux ? 0.75 : 0.95, 1); m.compose(p, q, sc); backRef.current!.setMatrixAt(i, m);
      const st = states[s.id];
      col.set(sel.has(s.id) ? '#8b5cf6' : st === 'held' ? '#a0603a' : lux ? '#7a2e44' : kindOf.get(s.categoryId) === 'premium' ? '#55407a' : '#3c4466');
      baseRef.current!.setColorAt(i, col); backRef.current!.setColorAt(i, col);
    });
    [baseRef, backRef].forEach((r) => { r.current!.instanceMatrix.needsUpdate = true; if (r.current!.instanceColor) r.current!.instanceColor.needsUpdate = true; r.current!.count = others.length; });
  }, [others, states, sel, kindOf]);

  useLayoutEffect(() => {
    if (!headRef.current) return;
    const m = new THREE.Matrix4();
    occupied.forEach((s, i) => { m.makeTranslation(s.x + Math.sin(s.yaw) * 0.18, s.eyeY - 0.02, s.z + Math.cos(s.yaw) * 0.18); headRef.current!.setMatrixAt(i, m); });
    headRef.current.count = occupied.length;
    headRef.current.instanceMatrix.needsUpdate = true;
  }, [occupied]);

  // ── Stepped floor (risers) ──
  const risers = useMemo(() => {
    const rows = new Map<number, { z: number; y: number }>();
    seats.forEach((s) => { const r = rows.get(s.rowIndex); if (!r || s.z > r.z) rows.set(s.rowIndex, { z: Math.max(r?.z ?? 0, s.z), y: s.floorY }); });
    const arr = [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
    return arr.map((r, i) => {
      const z0 = i === 0 ? r.z - g.rowSpacingM * 0.6 : (arr[i - 1].z + r.z) / 2;
      const z1 = i === arr.length - 1 ? room.depth : (r.z + arr[i + 1].z) / 2;
      return { y: r.y, z0, z1 };
    });
  }, [seats, g.rowSpacingM, room.depth]);

  const exitTex = useMemo(() => signTexture('EXIT', '#bbf7d0', '#065f46'), []);
  const W = room.halfWidth;
  const screenY = g.screenElevationM + g.screenHeightM / 2;
  const ceilingLights = useMemo(() => {
    const pts: [number, number, number][] = [];
    const n = quality === 'high' ? 160 : 60;
    let a = 7;
    for (let i = 0; i < n; i++) { a = (a * 16807) % 2147483647; const u = a / 2147483647; a = (a * 16807) % 2147483647; const v = a / 2147483647; pts.push([(u - 0.5) * W * 1.9, room.height - 0.05, 2 + v * (room.depth - 2.5)]); }
    return pts;
  }, [W, room, quality]);
  const starRef = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    ceilingLights.forEach((p, i) => { m.makeTranslation(...p); starRef.current!.setMatrixAt(i, m); });
    starRef.current!.instanceMatrix.needsUpdate = true;
  }, [ceilingLights]);

  const panelCount = Math.ceil(room.depth / 1.6);

  return (
    <>
      <color attach="background" args={['#020205']} />
      <fog attach="fog" args={['#07060f', 24, room.depth + 40]} />
      <ambientLight intensity={0.45} color="#b4bcff" />
      <hemisphereLight args={['#8b9cff', '#1a1030', 0.55]} />
      <group ref={world}>
        {/* screen */}
        <mesh position={[0, screenY, -0.02]}>
          <planeGeometry args={[g.screenWidthM + 0.6, g.screenHeightM + 0.5]} />
          <meshBasicMaterial color="#000" />
        </mesh>
        <mesh position={[0, screenY, 0]}>
          <planeGeometry args={[g.screenWidthM, g.screenHeightM]} />
          <meshBasicMaterial map={screenTex} toneMapped={false} />
        </mesh>
        <rectAreaLight ref={screenLight} position={[0, screenY, 0.3]} width={g.screenWidthM} height={g.screenHeightM} color={movie.palette[1]} intensity={5.5} rotation={[0, 0, 0]} />
        <pointLight position={[0, screenY, 3]} intensity={6} distance={room.depth} color={movie.palette[2]} decay={1.6} />
        {/* stage */}
        <mesh position={[0, g.screenElevationM / 2 - 0.2, -0.9]}><boxGeometry args={[g.screenWidthM + 2, g.screenElevationM, 1.6]} /><meshStandardMaterial color="#0b0b12" roughness={0.9} /></mesh>

        {/* floor + risers */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, room.depth / 2 - 1]}><planeGeometry args={[W * 2, room.depth + 2]} /><meshStandardMaterial color="#20172f" roughness={0.95} /></mesh>
        {risers.map((r, i) => r.y > 0 && (
          <mesh key={i} position={[0, r.y / 2, (r.z0 + r.z1) / 2]}><boxGeometry args={[W * 2, r.y, r.z1 - r.z0]} /><meshStandardMaterial color="#251b38" roughness={0.95} /></mesh>
        ))}
        {/* aisle step lights along both sides of each riser */}
        {risers.map((r, i) => [-1, 1].map((side) => (
          <mesh key={`${i}${side}`} position={[side * (W - 0.6), r.y + 0.03, r.z0 + 0.02]}><boxGeometry args={[0.5, 0.03, 0.04]} /><meshBasicMaterial color="#7dd3fc" toneMapped={false} /></mesh>
        )))}

        {/* side walls with acoustic panels + sconces */}
        {[-1, 1].map((side) => (
          <group key={side}>
            <mesh position={[side * W, room.height / 2, room.depth / 2 - 1]} rotation={[0, -side * Math.PI / 2, 0]}><planeGeometry args={[room.depth + 2, room.height]} /><meshStandardMaterial color="#1c1630" roughness={1} /></mesh>
            {Array.from({ length: panelCount }, (_, i) => (
              <mesh key={i} position={[side * (W - 0.08), room.height * 0.55, 1 + i * 1.6]}><boxGeometry args={[0.12, room.height * 0.62, 1.3]} /><meshStandardMaterial color={i % 2 ? '#2c2050' : '#3a2a66'} roughness={0.85} /></mesh>
            ))}
            {Array.from({ length: Math.ceil(panelCount / 2) }, (_, i) => (
              <mesh key={`l${i}`} position={[side * (W - 0.18), room.height * 0.3, 1.8 + i * 3.2]}><boxGeometry args={[0.05, 0.5, 0.12]} /><meshBasicMaterial color="#c4b5fd" toneMapped={false} /></mesh>
            ))}
            {Array.from({ length: quality === 'high' ? 3 : 1 }, (_, k) => <pointLight key={k} position={[side * (W - 0.7), room.height * 0.45, (room.depth * (k + 1)) / (quality === 'high' ? 4 : 2)]} intensity={4} distance={12} decay={1.4} color="#a78bfa" />)}
          </group>
        ))}
        {/* rear wall + projection booth window */}
        <mesh position={[0, room.height / 2, room.depth]} rotation={[0, Math.PI, 0]}><planeGeometry args={[W * 2, room.height]} /><meshStandardMaterial color="#171126" /></mesh>
        <mesh position={[0, room.height - 1.2, room.depth - 0.01]} rotation={[0, Math.PI, 0]}><planeGeometry args={[1.4, 0.6]} /><meshBasicMaterial color="#fef3c7" toneMapped={false} /></mesh>
        {/* ceiling + star lights */}
        <mesh position={[0, room.height, room.depth / 2 - 1]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[W * 2, room.depth + 2]} /><meshStandardMaterial color="#07060d" /></mesh>
        <instancedMesh ref={starRef} args={[undefined, undefined, ceilingLights.length]}>
          <sphereGeometry args={[0.025, 6, 6]} /><meshBasicMaterial color="#e0e7ff" toneMapped={false} />
        </instancedMesh>
        {/* exits */}
        {layout.exits.map((ex, i) => {
          const row = seats.filter((s) => s.rowIndex === Math.min(ex.rowIndex, layout.rows.length - 1));
          const z = row.length ? row[0].z : 2; const y = (row[0]?.floorY ?? 0) + 2.3;
          if (ex.side === 'rear') return <mesh key={i} position={[W - 2, room.maxFloor + 2.4, room.depth - 0.02]} rotation={[0, Math.PI, 0]}><planeGeometry args={[0.8, 0.3]} /><meshBasicMaterial map={exitTex} toneMapped={false} /></mesh>;
          const s = ex.side === 'left' ? -1 : 1;
          return (
            <group key={i}>
              <mesh position={[s * (W - 0.02), y, z]} rotation={[0, -s * Math.PI / 2, 0]}><planeGeometry args={[0.8, 0.3]} /><meshBasicMaterial map={exitTex} toneMapped={false} /></mesh>
              <mesh position={[s * (W - 0.02), (row[0]?.floorY ?? 0) + 1.05, z]} rotation={[0, -s * Math.PI / 2, 0]}><planeGeometry args={[1.1, 2.1]} /><meshStandardMaterial color="#1f1a2e" /></mesh>
            </group>
          );
        })}

        {/* seats & audience */}
        <instancedMesh ref={baseRef} args={[undefined, undefined, others.length]}>
          <boxGeometry args={[1, 0.18, 1]} /><meshStandardMaterial roughness={0.75} />
        </instancedMesh>
        <instancedMesh ref={backRef} args={[undefined, undefined, others.length]}>
          <boxGeometry args={[1, 0.62, 0.12]} /><meshStandardMaterial roughness={0.75} />
        </instancedMesh>
        <instancedMesh ref={headRef} args={[undefined, undefined, Math.max(1, occupied.length)]}>
          <sphereGeometry args={[0.1, 14, 12]} /><meshStandardMaterial color="#15121f" roughness={0.7} />
        </instancedMesh>
        {/* your seat's armrests, visible when looking down */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[seat.x + Math.cos(seat.yaw) * s * 0.3, seat.floorY + 0.62, seat.z - Math.sin(seat.yaw) * s * 0.3 - 0.1]} rotation={[0, seat.yaw, 0]}><boxGeometry args={[0.07, 0.06, 0.55]} /><meshStandardMaterial color="#3b2a63" /></mesh>
        ))}
      </group>
    </>
  );
}

/** 180° / 360° photograph mapped on a sphere around the viewer. */
export function PanoramaSphere({ url, projection, yawOffsetDeg }: { url: string; projection: '180' | '360'; yawOffsetDeg: number }) {
  const tex = useMemo(() => { const t = new THREE.TextureLoader().load(url); t.colorSpace = THREE.SRGBColorSpace; return t; }, [url]);
  return (
    <mesh scale={[-1, 1, 1]} rotation={[0, (yawOffsetDeg * Math.PI) / 180, 0]}>
      {projection === '180' ? <sphereGeometry args={[60, 64, 40, Math.PI, Math.PI]} /> : <sphereGeometry args={[60, 64, 40, Math.PI / 2, Math.PI * 2]} />}
      <meshBasicMaterial map={tex} side={THREE.BackSide} toneMapped={false} />
    </mesh>
  );
}
