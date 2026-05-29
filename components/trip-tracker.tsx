'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation, X } from 'lucide-react';

type ActiveTrip = { lat: number; lng: number; startedAt: number };

const TRIP_KEY = 'mileage_active_trip';

// Haversine great-circle distance in miles, with a 1.4× road-tortuosity
// correction — converts crow-flies to a reasonable driving-distance estimate.
// IRS documentation only requires "approximate" distance; this is within ~10%.
function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const crow = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(crow * 1.4 * 10) / 10;
}

function getGPS(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) reject(new Error('Geolocation not supported in this browser.'));
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15_000,
    });
  });
}

function formatElapsed(ms: number): string {
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

interface Props {
  /** Called with the one-way mile estimate when arrival is marked. */
  onMiles: (miles: number) => void;
}

export function TripTracker({ onMiles }: Props) {
  const [trip, setTrip] = useState<ActiveTrip | null>(null);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore any in-progress trip from storage (survives tab switches).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(TRIP_KEY);
      if (raw) setTrip(JSON.parse(raw) as ActiveTrip);
    } catch {
      // Corrupt storage — ignore.
    }
  }, []);

  // Keep the elapsed-time display ticking.
  useEffect(() => {
    if (!trip) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [trip]);

  async function handleStart() {
    setLoading(true);
    setError(null);
    try {
      const pos = await getGPS();
      const data: ActiveTrip = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        startedAt: Date.now(),
      };
      localStorage.setItem(TRIP_KEY, JSON.stringify(data));
      setTrip(data);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'Could not get your location. Check that location access is allowed for this site.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleArrived() {
    if (!trip) return;
    setLoading(true);
    setError(null);
    try {
      const pos = await getGPS();
      const miles = haversineMiles(trip.lat, trip.lng, pos.coords.latitude, pos.coords.longitude);
      localStorage.removeItem(TRIP_KEY);
      setTrip(null);
      onMiles(miles);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'Could not get your location. Move to an open area and try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    localStorage.removeItem(TRIP_KEY);
    setTrip(null);
    setError(null);
  }

  if (trip) {
    return (
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Navigation size={16} className="animate-pulse text-primary" />
          <p className="text-sm font-medium text-primary">Trip in progress</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Started {formatElapsed(now - trip.startedAt)}. When you arrive, tap{' '}
          <strong>Mark arrival</strong> to measure the distance automatically.
        </p>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={handleArrived}
            disabled={loading}
            className="flex-1"
          >
            {loading ? 'Getting location…' : 'Mark arrival'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={loading}
            aria-label="Cancel trip"
          >
            <X size={14} />
          </Button>
        </div>
      </div>
    );
  }

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
        {loading ? 'Getting location…' : 'Start trip — auto-measure distance'}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <p className="text-xs text-muted-foreground">
        Tap before you leave. When you arrive, open the app and tap{' '}
        <strong>Mark arrival</strong> to fill in the miles automatically.
      </p>
    </div>
  );
}
