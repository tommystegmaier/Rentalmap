'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PenLine } from 'lucide-react';
import { landlordSignLease } from './actions';
import { BusyBar } from '@/components/busy-bar';
import { SignaturePad } from '@/components/signature-pad';

export function LandlordSignForm({ leaseId }: { leaseId: string }) {
  const [name, setName] = useState('');
  const [sigDataUrl, setSigDataUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSign(e: React.FormEvent) {
    e.preventDefault();
    if (!sigDataUrl) {
      setError('Please draw your signature above before signing.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await landlordSignLease(leaseId, name, sigDataUrl);
      toast.success('Lease signed as landlord');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSign} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Your signature</Label>
        <SignaturePad onSign={setSigDataUrl} disabled={busy} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="landlord-name">Full legal name (typed)</Label>
        <Input
          id="landlord-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Smith"
          required
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <p className="text-xs text-muted-foreground">
        By signing above and clicking below you are electronically signing this lease and agree
        to all terms stated above.
      </p>
      <Button type="submit" disabled={busy || !sigDataUrl} className="w-full">
        <PenLine size={14} />
        {busy ? 'Signing…' : 'I agree — sign as landlord'}
      </Button>
      <BusyBar active={busy} />
    </form>
  );
}
