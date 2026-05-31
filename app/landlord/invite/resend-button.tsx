'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCw, CheckCheck, Copy } from 'lucide-react';
import { copyToClipboard } from '@/lib/clipboard';

export function ResendInviteButton({ email, leaseId }: { email: string; leaseId: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'link'>('idle');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resend() {
    setState('busy');
    setError(null);
    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lease_id: leaseId, email }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Failed');
        setState('idle');
        return;
      }
      if (json.inviteLink) {
        setInviteLink(json.inviteLink);
        setState('link');
      } else {
        setState('sent');
        setTimeout(() => setState('idle'), 4000);
      }
    } catch {
      setError('Network error');
      setState('idle');
    }
  }

  async function copyLink() {
    if (!inviteLink) return;
    await copyToClipboard(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  if (state === 'link' && inviteLink) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 gap-1 text-xs border-amber-400 dark:border-amber-600"
          onClick={copyLink}
        >
          {copied ? <CheckCheck size={11} /> : <Copy size={11} />}
          {copied ? 'Copied!' : 'Copy link'}
        </Button>
        <p className="text-xs text-muted-foreground text-right">Rate-limited — share manually</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 gap-1 text-xs"
        disabled={state === 'busy' || state === 'sent'}
        onClick={resend}
      >
        <RotateCw size={11} className={state === 'busy' ? 'animate-spin' : ''} />
        {state === 'sent' ? 'Sent!' : state === 'busy' ? 'Sending…' : 'Resend'}
      </Button>
      {error ? <p className="text-xs text-destructive text-right max-w-[160px]">{error}</p> : null}
    </div>
  );
}
