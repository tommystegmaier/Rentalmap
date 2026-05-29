'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BusyBar } from '@/components/busy-bar';

interface Props {
  initialEnabled: boolean;
  initialDays: number;
}

export function NotificationSettings({ initialEnabled, initialDays }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [days, setDays] = useState(initialDays);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/landlord/notification-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, daysBefore: days }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Failed to save');
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-3 text-sm">
      <label className="flex items-start gap-3 rounded-lg border p-3">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="mt-0.5 h-4 w-4"
        />
        <div>
          <p className="font-medium">Send tenants rent reminders</p>
          <p className="text-muted-foreground">
            A friendly push notification on each tenant&apos;s phone before rent is due.
          </p>
        </div>
      </label>

      <div className="space-y-2">
        <Label htmlFor="days">Days before rent is due</Label>
        <Input
          id="days"
          type="number"
          min={0}
          max={14}
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          disabled={!enabled}
          className="w-24"
        />
        <p className="text-xs text-muted-foreground">
          0 = same day. 1 = day before. 3 is a good default. Max 14.
        </p>
      </div>

      {error ? <p className="text-destructive">{error}</p> : null}
      {saved ? <p className="text-success">Saved.</p> : null}

      <Button type="submit" disabled={busy}>
        {busy ? 'Saving…' : 'Save'}
      </Button>
      <BusyBar active={busy} />
    </form>
  );
}
