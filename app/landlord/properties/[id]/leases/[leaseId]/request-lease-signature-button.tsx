'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Send, CheckCircle2 } from 'lucide-react';

export function RequestLeaseSignatureButton({ leaseId }: { leaseId: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function send() {
    setState('busy');
    try {
      const res = await fetch(`/api/lease/${leaseId}/request-signature`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Failed to send');
        setState('error');
      } else {
        setState('sent');
        setTimeout(() => setState('idle'), 4000);
      }
    } catch {
      setErrorMsg('Network error — try again.');
      setState('error');
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="font-medium text-foreground">Request tenant signature</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Send a push notification to your tenant asking them to sign the lease. You can
          resend as many times as needed until they sign.
        </p>
      </div>
      {state === 'error' && <p className="text-sm text-destructive">{errorMsg}</p>}
      <Button
        onClick={send}
        disabled={state === 'busy'}
        size="sm"
        variant={state === 'sent' ? 'outline' : 'default'}
        className="gap-2"
      >
        {state === 'sent' ? (
          <>
            <CheckCircle2 size={15} className="text-success" />
            Notification sent
          </>
        ) : (
          <>
            <Send size={15} />
            {state === 'busy' ? 'Sending…' : 'Send signature request'}
          </>
        )}
      </Button>
    </div>
  );
}
