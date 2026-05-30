'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Download, PenLine } from 'lucide-react';
import { tenantSignLease } from './actions';
import { BusyBar } from '@/components/busy-bar';

export function TenantSignForm({ leaseId }: { leaseId: string }) {
  const router = useRouter();
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
      // Bust the client-side router cache so the home page action card
      // disappears and this page reflects the signed state on next render.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
          <CheckCircle2 size={16} />
          Lease signed successfully.
        </div>
        <a href={`/api/lease/${leaseId}/pdf`} download>
          <Button variant="outline" className="w-full gap-2">
            <Download size={14} />
            Download signed PDF
          </Button>
        </a>
      </div>
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
