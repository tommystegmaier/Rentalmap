'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { BusyBar } from '@/components/busy-bar';

interface InviteFormProps {
  leases: { id: string; address: string; monthly_rent_cents: number }[];
}

export function InviteForm({ leases }: InviteFormProps) {
  const router = useRouter();
  const [leaseId, setLeaseId] = useState(leases[0]?.id ?? '');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSent(false);
    setBusy(true);

    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lease_id: leaseId, email: email.trim().toLowerCase() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to send invitation');
      setEmail('');
      setSent(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="lease">Lease</Label>
        <Select id="lease" value={leaseId} onChange={(e) => setLeaseId(e.target.value)}>
          {leases.map((l) => (
            <option key={l.id} value={l.id}>
              {l.address} (${(l.monthly_rent_cents / 100).toFixed(0)}/mo)
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Tenant email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="matthew@example.com"
          required
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {sent ? <p className="text-sm text-success">Invitation sent.</p> : null}

      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? 'Sending…' : 'Send invitation'}
      </Button>
      <BusyBar active={busy} />
    </form>
  );
}
