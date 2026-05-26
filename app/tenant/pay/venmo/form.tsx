'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { submitVenmoClaim } from './actions';

interface Props {
  leaseId: string;
  amountCents: number;
  expectedDate: string;
  hasPending: boolean;
}

export function VenmoClaimForm({ leaseId, amountCents, expectedDate, hasPending }: Props) {
  const router = useRouter();
  const [venmoNote, setVenmoNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set('lease_id', leaseId);
      fd.set('amount_cents', String(amountCents));
      fd.set('expected_date', expectedDate);
      fd.set('venmo_note', venmoNote.trim());
      await submitVenmoClaim(fd);
      setDone(true);
      setTimeout(() => router.push('/tenant/pay'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-lg border border-success/30 bg-success/5 p-4 text-sm text-success">
        Payment logged. Your landlord has been notified and will confirm receipt shortly.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="venmo-note">Venmo note / memo</Label>
        <Textarea
          id="venmo-note"
          rows={2}
          value={venmoNote}
          onChange={(e) => setVenmoNote(e.target.value)}
          placeholder="e.g. May rent, 123 Main St"
        />
        <p className="text-xs text-muted-foreground">
          Enter the note you included on your Venmo payment so your landlord can match it.
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" className="w-full" disabled={busy || hasPending}>
        {busy ? 'Submitting…' : hasPending ? 'Already submitted' : 'Notify landlord — I sent this Venmo'}
      </Button>
    </form>
  );
}
