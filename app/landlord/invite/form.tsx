'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { BusyBar } from '@/components/busy-bar';
import { Copy, CheckCheck } from 'lucide-react';

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
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSent(false);
    setInviteLink(null);
    setCopied(false);
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
      if (json.inviteLink) {
        setInviteLink(json.inviteLink);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
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

      {sent && !inviteLink ? (
        <p className="text-sm text-success">Invitation email sent.</p>
      ) : null}

      {sent && inviteLink ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/40 space-y-2">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            Email was rate-limited — share this link directly
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Copy the link below and send it to your tenant via text or email. It works the same as the invite email.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5 border-amber-400 dark:border-amber-600"
            onClick={copyLink}
          >
            {copied ? <CheckCheck size={13} /> : <Copy size={13} />}
            {copied ? 'Copied!' : 'Copy invite link'}
          </Button>
        </div>
      ) : null}

      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? 'Sending…' : sent ? 'Resend invitation' : 'Send invitation'}
      </Button>
      <BusyBar active={busy} />
    </form>
  );
}
