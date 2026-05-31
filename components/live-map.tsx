'use client';

import { useEffect, useRef } from 'react';

interface Coord { lat: number; lng: number }

interface Props {
  path: Coord[];
  current: Coord | null;
}

declare global {
  interface Window { L: any }
}

async function loadLeaflet(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (window.L) return;

  if (!document.getElementById('leaflet-css')) {
    const link = document.createElement('link');
    link.id = 'leaflet-css';
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }

  await new Promise<void>((resolve, reject) => {
    if (document.getElementById('leaflet-js')) { resolve(); return; }
    const s = document.createElement('script');
    s.id = 'leaflet-js';
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Leaflet'));
    document.head.appendChild(s);
  });
}

const BLUE_DOT = `
  <div style="width:14px;height:14px;border-radius:50%;
    background:#4a9ad4;border:3px solid white;
    box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>
`;

export function LiveMap({ path, current }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    if (!current || !containerRef.current) return;

    let cancelled = false;

    loadLeaflet().then(() => {
      if (cancelled || !containerRef.current) return;
      const L = window.L;

      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, { zoomControl: false, attributionControl: false })
          .setView([current.lat, current.lng], 16);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapRef.current);

        const icon = L.divIcon({ html: BLUE_DOT, className: '', iconSize: [14, 14], iconAnchor: [7, 7] });
        markerRef.current = L.marker([current.lat, current.lng], { icon }).addTo(mapRef.current);
        polylineRef.current = L.polyline(
          path.map(p => [p.lat, p.lng]),
          { color: '#4a9ad4', weight: 4, opacity: 0.85 },
        ).addTo(mapRef.current);
      } else {
        markerRef.current?.setLatLng([current.lat, current.lng]);
        mapRef.current.panTo([current.lat, current.lng]);
        polylineRef.current?.setLatLngs(path.map(p => [p.lat, p.lng]));
      }
    }).catch(() => {});

    return () => { cancelled = true; };
  }, [path, current]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      polylineRef.current = null;
      markerRef.current = null;
    };
  }, []);

  if (!current) return null;

  return (
    <div
      ref={containerRef}
      className="w-full rounded-xl border overflow-hidden"
      style={{ height: 200, background: '#e8f0e8' }}
    />
  );
}
