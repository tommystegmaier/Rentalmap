'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

type StripeStatus = 'not_connected' | 'restricted' | 'active';

export function StripeConnectButton({
  connected,
  stripeStatus,
}: {
  connected: boolean;
  stripeStatus: StripeStatus;
}) {
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

  const label = busy
    ? 'Opening Stripe…'
    : stripeStatus === 'restricted'
      ? 'Complete Stripe verification'
      : stripeStatus === 'active'
        ? 'Manage Stripe account'
        : 'Connect Stripe account';

  return (
    <div className="space-y-2">
      <Button
        onClick={handleConnect}
        disabled={busy}
        variant={stripeStatus === 'restricted' ? 'default' : stripeStatus === 'active' ? 'outline' : 'default'}
      >
        {label}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
