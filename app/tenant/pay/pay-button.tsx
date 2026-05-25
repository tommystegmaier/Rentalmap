'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface PayButtonProps {
  leaseId: string;
  expectedDate: string;
  method: 'ach' | 'card';
  label: string;
  variant?: 'default' | 'outline';
}

export function PayButton({
  leaseId,
  expectedDate,
  method,
  label,
  variant = 'default',
}: PayButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lease_id: leaseId, expected_date: expectedDate, method }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to start payment');
      window.location.href = json.url;
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={handlePay} disabled={busy} variant={variant} className="w-full">
        {busy ? 'Opening secure checkout…' : label}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
