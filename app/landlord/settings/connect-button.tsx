'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function StripeConnectButton({ connected }: { connected: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe/connect', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to start Stripe onboarding');
      window.location.href = json.url;
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={handleConnect} disabled={busy}>
        {busy
          ? 'Opening Stripe…'
          : connected
            ? 'Re-open Stripe onboarding'
            : 'Connect Stripe account'}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
