'use client';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useEffect } from 'react';
import type { TheatreListing } from '@/lib/catalog';

const pin = (active: boolean) => L.divIcon({
  className: '',
  html: `<div style="position:relative;width:22px;height:22px;transform:translate(-50%,-50%)"><span style="position:absolute;inset:0;border-radius:9999px;background:${active ? '#b04cff' : '#4f8cff'};opacity:.35;${active ? 'animation:pulseRing 1.6s ease-out infinite' : ''}"></span><span style="position:absolute;inset:5px;border-radius:9999px;background:${active ? '#fff' : '#c7d2fe'};box-shadow:0 0 18px ${active ? '#b04cff' : '#4f8cff'}"></span></div>`,
  iconSize: [0, 0],
});
const me = L.divIcon({ className: '', html: '<div style="width:14px;height:14px;transform:translate(-50%,-50%);border-radius:9999px;background:#3ee0ff;border:3px solid #04050a;box-shadow:0 0 0 6px rgba(62,224,255,.25)"></div>', iconSize: [0, 0] });

function Fit({ theatres, center }: { theatres: TheatreListing[]; center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    const pts = theatres.map((t) => [t.lat, t.lng] as [number, number]).concat([center]);
    if (pts.length > 1) map.fitBounds(L.latLngBounds(pts).pad(0.25), { animate: true, maxZoom: 14 });
    else map.setView(center, 12);
  }, [theatres, center, map]);
  return null;
}

export default function TheatreMap({ theatres, center, activeId, onSelect }: { theatres: TheatreListing[]; center: [number, number]; activeId?: string | null; onSelect: (id: string) => void }) {
  return (
    <MapContainer center={center} zoom={12} scrollWheelZoom className="h-full w-full" attributionControl>
      <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>' />
      <Marker position={center} icon={me}><Popup>You are here</Popup></Marker>
      {theatres.map((t) => (
        <Marker key={t.id} position={[t.lat, t.lng]} icon={pin(t.id === activeId)} eventHandlers={{ click: () => onSelect(t.id) }}>
          <Popup><b>{t.name}</b><br />{t.distanceKm != null ? `${t.distanceKm} km · ` : ''}★ {t.rating}</Popup>
        </Marker>
      ))}
      <Fit theatres={theatres} center={center} />
    </MapContainer>
  );
}
