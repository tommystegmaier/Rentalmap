'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation, X } from 'lucide-react';

// Persisted across tab switches; watchPosition itself is runtime-only.
type SavedTrip = {
  totalMiles: number;
  startedAt: number;
  lastLat: number | null;
  lastLng: number | null;
};

const TRIP_KEY = 'mileage_active_trip';

// Raw Haversine with no correction factor — we accumulate real path segments
// now, so there's no crow-flies gap to correct for.
function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Minimum meters of GPS accuracy to accept a fix.
const MAX_ACCURACY_M = 200;
// Minimum miles for a segment to count — filters GPS drift while stationary.
const MIN_SEGMENT_MI = 0.01;
// Maximum miles for a single GPS update — filters GPS teleportation jumps.
const MAX_SEGMENT_MI = 0.75;

function loadSaved(): SavedTrip | null {
  try {
    const raw = localStorage.getItem(TRIP_KEY);
    return raw ? (JSON.parse(raw) as SavedTrip) : null;
  } catch {
    return null;
  }
}

function persist(trip: SavedTrip) {
  try { localStorage.setItem(TRIP_KEY, JSON.stringify(trip)); } catch {}
}

function clearSaved() {
  localStorage.removeItem(TRIP_KEY);
}

function formatElapsed(ms: number): string {
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

interface Props {
  onMiles: (miles: number) => void;
}

export function TripTracker({ onMiles }: Props) {
  const [active, setActive]         = useState(false);
  const [displayMiles, setDisplay]  = useState(0);
  const [startedAt, setStartedAt]   = useState<number | null>(null);
  const [now, setNow]               = useState(Date.now());
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // Mutable tracking state — in refs so the watchPosition callback always
  // sees the latest values without triggering re-renders on every GPS fix.
  const accMiles  = useRef(0);
  const lastPos   = useRef<{ lat: number; lng: number } | null>(null);
  const watchId   = useRef<number | null>(null);
  const wakeLock  = useRef<WakeLockSentinel | null>(null);

  // ── Wake lock helpers ────────────────────────────────────────────────────
  async function acquireWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        wakeLock.current = await (navigator as unknown as {
          wakeLock: { request(t: 'screen'): Promise<WakeLockSentinel> };
        }).wakeLock.request('screen');
      }
    } catch { /* best-effort */ }
  }

  function releaseWakeLock() {
    wakeLock.current?.release().catch(() => {});
    wakeLock.current = null;
  }

  // ── Core watch starter ───────────────────────────────────────────────────
  const startWatch = useCallback((initialMiles: number, tripStart: number) => {
    if (!navigator.geolocation) return;

    accMiles.current = initialMiles;

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        if (accuracy > MAX_ACCURACY_M) return;

        if (lastPos.current) {
          const seg = haversineMiles(
            lastPos.current.lat, lastPos.current.lng,
            latitude, longitude,
          );
          if (seg >= MIN_SEGMENT_MI && seg <= MAX_SEGMENT_MI) {
            accMiles.current += seg;
            // Round to one decimal for display; keep raw for final value.
            setDisplay(Math.round(accMiles.current * 10) / 10);
          }
        }

        lastPos.current = { lat: latitude, lng: longitude };
        persist({
          totalMiles: accMiles.current,
          startedAt: tripStart,
          lastLat: latitude,
          lastLng: longitude,
        });
      },
      () => { /* transient GPS errors are normal while driving — suppress */ },
      { enableHighAccuracy: true, maximumAge: 3_000, timeout: 10_000 },
    );

    watchId.current = id;
  }, []);

  // ── Restore an in-progress trip on mount (e.g. after tab switch) ─────────
  useEffect(() => {
    const saved = loadSaved();
    if (!saved) return;

    lastPos.current = saved.lastLat != null && saved.lastLng != null
      ? { lat: saved.lastLat, lng: saved.lastLng }
      : null;

    setActive(true);
    setDisplay(Math.round(saved.totalMiles * 10) / 10);
    setStartedAt(saved.startedAt);
    startWatch(saved.totalMiles, saved.startedAt);

    return () => {
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
      releaseWakeLock();
    };
  }, [startWatch]);

  // ── Elapsed-time ticker ──────────────────────────────────────────────────
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [active]);

  // ── User actions ─────────────────────────────────────────────────────────
  async function handleStart() {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported in this browser.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15_000,
        }),
      );

      const tripStart = Date.now();
      lastPos.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      accMiles.current = 0;

      persist({ totalMiles: 0, startedAt: tripStart, lastLat: pos.coords.latitude, lastLng: pos.coords.longitude });

      setActive(true);
      setDisplay(0);
      setStartedAt(tripStart);
      setNow(Date.now());

      await acquireWakeLock();
      startWatch(0, tripStart);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'Could not get your location. Make sure location access is allowed.',
      );
    } finally {
      setLoading(false);
    }
  }

  function handleArrived() {
    if (watchId.current != null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    releaseWakeLock();
    clearSaved();

    const finalMiles = Math.round(accMiles.current * 10) / 10;

    setActive(false);
    setDisplay(0);
    setStartedAt(null);
    lastPos.current = null;
    accMiles.current = 0;

    onMiles(finalMiles || 0);
  }

  function handleCancel() {
    if (watchId.current != null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    releaseWakeLock();
    clearSaved();
    setActive(false);
    setDisplay(0);
    setStartedAt(null);
    lastPos.current = null;
    accMiles.current = 0;
    setError(null);
  }

  // ── Render: active trip ──────────────────────────────────────────────────
  if (active) {
    return (
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Navigation size={16} className="animate-pulse text-primary" />
            <p className="text-sm font-medium text-primary">Tracking trip</p>
          </div>
          <p className="text-2xl font-bold tabular-nums text-primary">
            {displayMiles.toFixed(1)} mi
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Started {startedAt ? formatElapsed(now - startedAt) : ''}. GPS is tracking your
          path continuously — keep this screen open for best accuracy. Tap{' '}
          <strong>Mark arrival</strong> when you get there.
        </p>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        <div className="flex gap-2">
          <Button type="button" onClick={handleArrived} className="flex-1">
            Mark arrival · {displayMiles.toFixed(1)} mi
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            aria-label="Cancel trip"
          >
            <X size={14} />
          </Button>
        </div>
      </div>
    );
  }

  // ── Render: idle ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        onClick={handleStart}
        disabled={loading}
        className="w-full"
      >
        <MapPin size={14} />
        {loading ? 'Getting location…' : 'Start trip — track distance'}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <p className="text-xs text-muted-foreground">
        Tap before you leave — GPS tracks your actual path as you drive. Keep this
        screen open while driving for best accuracy.
      </p>
    </div>
  );
}
