'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { TripTracker } from '@/components/trip-tracker';
import { mileageRateForYear, MILEAGE_PURPOSES } from '@/lib/mileage';
import { createMileageTrip } from './actions';
import { BusyBar } from '@/components/busy-bar';

// Per-property distance cache key in localStorage.
const CACHE_KEY = 'mileage_property_distances';

function loadCache(): Record<string, number> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function saveToCache(propertyId: string, miles: number) {
  const cache = loadCache();
  cache[propertyId] = miles;
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

interface Props {
  properties: { id: string; address: string }[];
  initialPropertyId: string;
  defaultRate: number;
  today: string;
}

export function MileageForm({ properties, initialPropertyId, defaultRate, today }: Props) {
  const router = useRouter();
  const [propertyId, setPropertyId] = useState(initialPropertyId);
  const [miles, setMiles] = useState('');
  const [roundTrip, setRoundTrip] = useState(true);
  const [tripDate, setTripDate] = useState(today);
  const [purpose, setPurpose] = useState<string>(MILEAGE_PURPOSES[0]);
  const [rate, setRate] = useState(String(defaultRate));
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedMiles, setCachedMiles] = useState<number | null>(null);
  const [gpsFilled, setGpsFilled] = useState(false);

  // Load cached distance for the initially selected property.
  useEffect(() => {
    const cache = loadCache();
    setCachedMiles(cache[initialPropertyId] ?? null);
  }, [initialPropertyId]);

  function handlePropertyChange(id: string) {
    setPropertyId(id);
    const cache = loadCache();
    const cached = cache[id] ?? null;
    setCachedMiles(cached);
    setGpsFilled(false);
    // Don't auto-fill miles if the user has already typed something.
  }

  function handleGpsMiles(detectedMiles: number) {
    // GPS gives one-way distance; round-trip checkbox doubles it on submit.
    setMiles(String(detectedMiles));
    setGpsFilled(true);
    toast.success(`Distance measured: ${detectedMiles} mi (one way)`);
  }

  function handleUseCached() {
    if (cachedMiles != null) {
      setMiles(String(cachedMiles));
      setGpsFilled(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      let rawMiles = parseFloat(miles);
      if (!Number.isFinite(rawMiles) || rawMiles <= 0) {
        setError('Enter a valid mileage.');
        setBusy(false);
        return;
      }

      // Save one-way distance to cache before doubling for round trip.
      saveToCache(propertyId, rawMiles);

      if (roundTrip) rawMiles = Math.round(rawMiles * 2 * 10) / 10;

      const rateNum = parseFloat(rate);
      if (!Number.isFinite(rateNum) || rateNum <= 0) {
        setError('Enter a valid rate.');
        setBusy(false);
        return;
      }

      const fd = new FormData();
      fd.set('property_id', propertyId);
      fd.set('trip_date', tripDate);
      fd.set('miles', String(rawMiles));
      fd.set('round_trip', 'off'); // already applied above
      fd.set('rate', rate);
      fd.set('purpose', purpose);
      fd.set('notes', notes);

      await createMileageTrip(fd);
      toast.success('Trip logged');
      router.push('/landlord/mileage');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* GPS auto-measure */}
      <TripTracker onMiles={handleGpsMiles} />

      {/* Property */}
      <div className="space-y-2">
        <Label htmlFor="property">Property</Label>
        <Select
          id="property"
          value={propertyId}
          onChange={(e) => handlePropertyChange(e.target.value)}
        >
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.address}
            </option>
          ))}
        </Select>
      </div>

      {/* Miles */}
      <div className="space-y-2">
        <Label htmlFor="miles">Miles (one way)</Label>
        <Input
          id="miles"
          inputMode="decimal"
          placeholder="0.0"
          value={miles}
          onChange={(e) => { setMiles(e.target.value); setGpsFilled(false); }}
          required
        />
        {gpsFilled ? (
          <p className="text-xs text-success">
            Auto-measured from GPS · estimated driving distance (one way).
            Adjust if needed.
          </p>
        ) : cachedMiles != null ? (
          <p className="text-xs text-muted-foreground">
            Last logged to this property: {cachedMiles} mi one way ·{' '}
            <button
              type="button"
              className="font-medium text-primary underline-offset-2 hover:underline"
              onClick={handleUseCached}
            >
              Use this
            </button>
          </p>
        ) : null}
      </div>

      {/* Round trip */}
      <label className="flex items-center gap-3 rounded-lg border p-3 tap-44">
        <input
          type="checkbox"
          checked={roundTrip}
          onChange={(e) => setRoundTrip(e.target.checked)}
          className="h-4 w-4"
        />
        <span className="flex-1 text-sm">
          <span className="font-medium">Round trip</span>
          <span className="block text-xs text-muted-foreground">
            Doubles the miles above.{miles && roundTrip
              ? ` Total: ${Math.round(parseFloat(miles) * 2 * 10) / 10 || 0} mi`
              : ''}
          </span>
        </span>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="trip-date">Trip date</Label>
          <Input
            id="trip-date"
            type="date"
            value={tripDate}
            onChange={(e) => setTripDate(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="purpose">Purpose</Label>
          <Select
            id="purpose"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
          >
            {MILEAGE_PURPOSES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="rate">Rate (¢ per mile)</Label>
        <Input
          id="rate"
          inputMode="decimal"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          required
        />
        <p className="text-xs text-muted-foreground">
          IRS standard rate for {new Date().getFullYear()}: {defaultRate}¢/mi.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea
          id="notes"
          rows={2}
          placeholder="e.g. Met the HVAC tech for the annual service."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? 'Saving…' : 'Save trip'}
      </Button>
      <BusyBar active={busy} />
    </form>
  );
}
