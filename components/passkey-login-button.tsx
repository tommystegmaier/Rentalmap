'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { startAuthentication } from '@simplewebauthn/browser';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { BusyBar } from '@/components/busy-bar';
import { Fingerprint } from 'lucide-react';

export function PasskeyLoginButton({ next }: { next: string }) {
  const router = useRouter();
  const [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSupported(
      typeof window !== 'undefined' &&
        typeof window.PublicKeyCredential !== 'undefined',
    );
  }, []);

  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      const optRes = await fetch('/api/auth/webauthn/authenticate/options', { method: 'POST' });
      if (!optRes.ok) throw new Error('Could not start sign-in');
      const options = await optRes.json();

      const credential = await startAuthentication({ optionsJSON: options });

      const verifyRes = await fetch('/api/auth/webauthn/authenticate/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });
      const json = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok || !json.tokenHash) {
        throw new Error(json.error ?? 'Sign-in failed');
      }

      // Establish the Supabase session from the minted token_hash.
      const supabase = createClient();
      const { error: otpError } = await supabase.auth.verifyOtp({
        token_hash: json.tokenHash,
        type: 'magiclink',
      });
      if (otpError) throw new Error(otpError.message);

      router.push(next);
      router.refresh();
    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setBusy(false);
        return; // user cancelled the native sheet
      }
      setError(err instanceof Error ? err.message : 'Sign-in failed');
      setBusy(false);
    }
  }

  if (!supported) return null;

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" className="w-full" onClick={signIn} disabled={busy}>
        <Fingerprint size={16} />
        {busy ? 'Authenticating…' : 'Sign in with Face ID'}
      </Button>
      <BusyBar active={busy} />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
