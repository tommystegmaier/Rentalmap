'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PenLine } from 'lucide-react';
import { tenantSignLease } from './actions';
import { BusyBar } from '@/components/busy-bar';

export function TenantSignForm({ leaseId }: { leaseId: string }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSign(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await tenantSignLease(leaseId, name);
      toast.success('Lease signed successfully');
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p className="text-sm text-green-700 font-medium">
        ✓ Lease signed. Download a copy from the button above.
      </p>
    );
  }

  return (
    <form onSubmit={handleSign} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="tenant-name">Your full legal name</Label>
        <Input
          id="tenant-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Smith"
          required
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <p className="text-xs text-muted-foreground">
        By clicking below you are electronically signing this lease and agree to all terms listed
        above.
      </p>
      <Button type="submit" disabled={busy} className="w-full">
        <PenLine size={14} />
        {busy ? 'Signing…' : 'I agree — sign lease'}
      </Button>
      <BusyBar active={busy} />
    </form>
  );
}
