'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { BusyBar } from '@/components/busy-bar';

interface Props {
  leaseId: string;
  autopay: { id: string; status: string } | null;
  landlordConnected: boolean;
}

export function AutopayControls({ leaseId, autopay, landlordConnected }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setup() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe/autopay/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lease_id: leaseId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to start auto-pay');
      window.location.href = json.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setBusy(false);
    }
  }

  async function cancel() {
    if (!autopay) return;
    if (!confirm('Cancel auto-pay? You can set it up again any time.')) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe/autopay/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autopay_id: autopay.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to cancel');
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setBusy(false);
    }
  }

  if (autopay && autopay.status === 'active') {
    return (
      <div className="space-y-2">
        <p className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm">
          Auto-pay is on. Rent will be charged automatically each month.
        </p>
        <Button variant="outline" onClick={cancel} disabled={busy} className="w-full">
          {busy ? 'Canceling…' : 'Cancel auto-pay'}
        </Button>
        <BusyBar active={busy} />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    );
  }

  if (!landlordConnected) {
    return null;
  }

  return (
    <div className="space-y-2">
      <Button variant="outline" onClick={setup} disabled={busy} className="w-full">
        {busy ? 'Opening Stripe…' : 'Set up auto-pay'}
      </Button>
      <BusyBar active={busy} />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
