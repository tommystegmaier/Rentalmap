'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface PayButtonProps {
  leaseId: string;
  expectedDate: string;
  landlordConnected: boolean;
}

export function PayButton({ leaseId, expectedDate, landlordConnected }: PayButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lease_id: leaseId, expected_date: expectedDate }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to start payment');
      window.location.href = json.url;
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  if (!landlordConnected) {
    return (
      <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
        Your landlord hasn&apos;t finished connecting their bank yet. Please continue paying via
        Zelle, Venmo, or check; payments will be logged here.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Button onClick={handlePay} disabled={busy} className="w-full">
        {busy ? 'Opening secure checkout…' : 'Pay rent'}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
