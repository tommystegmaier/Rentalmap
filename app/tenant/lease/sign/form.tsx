'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, PenLine } from 'lucide-react';
import { tenantSignLease } from './actions';
import { BusyBar } from '@/components/busy-bar';
import { SignaturePad } from '@/components/signature-pad';

export function TenantSignForm({ leaseId }: { leaseId: string }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [hasSig, setHasSig] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSign(e: React.FormEvent) {
    e.preventDefault();
    if (!hasSig) {
      setError('Please draw your signature above before signing.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await tenantSignLease(leaseId, name);
      toast.success('Lease signed successfully');
      setDone(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
        <CheckCircle2 size={16} />
        Signed — loading your copy…
      </div>
    );
  }

  return (
    <form onSubmit={handleSign} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Your signature</Label>
        <SignaturePad onSign={setHasSig} disabled={busy} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="tenant-name">Full legal name (typed)</Label>
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
        By signing above and clicking below you are electronically signing this lease and agree
        to all terms listed above.
      </p>
      <Button type="submit" disabled={busy || !hasSig} className="w-full">
        <PenLine size={14} />
        {busy ? 'Signing…' : 'I agree — sign lease'}
      </Button>
      <BusyBar active={busy} />
    </form>
  );
}
