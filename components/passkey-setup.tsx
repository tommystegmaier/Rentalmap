'use client';

import { useEffect, useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { BusyBar } from '@/components/busy-bar';
import { Fingerprint, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface Passkey {
  id: string;
  device_label: string | null;
  created_at: string;
  last_used_at: string | null;
}

export function PasskeySetup() {
  const [supported, setSupported] = useState(true);
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSupported(
      typeof window !== 'undefined' &&
        typeof window.PublicKeyCredential !== 'undefined',
    );
    refresh();
  }, []);

  async function refresh() {
    try {
      const res = await fetch('/api/auth/webauthn/passkeys');
      if (res.ok) {
        const json = await res.json();
        setPasskeys(json.passkeys ?? []);
      }
    } finally {
      setLoaded(true);
    }
  }

  async function addPasskey() {
    setBusy(true);
    try {
      const optRes = await fetch('/api/auth/webauthn/register/options', { method: 'POST' });
      if (!optRes.ok) throw new Error('Could not start setup');
      const options = await optRes.json();

      const credential = await startRegistration({ optionsJSON: options });

      const label =
        /iphone|ipad|ipod/i.test(navigator.userAgent)
          ? 'iPhone / iPad'
          : /mac/i.test(navigator.userAgent)
            ? 'Mac'
            : /android/i.test(navigator.userAgent)
              ? 'Android'
              : 'This device';

      const verifyRes = await fetch('/api/auth/webauthn/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential, label }),
      });
      if (!verifyRes.ok) {
        const j = await verifyRes.json().catch(() => ({}));
        throw new Error(j.error ?? 'Setup failed');
      }
      toast.success('Face ID / passkey enabled');
      await refresh();
    } catch (err) {
      // User cancelling the native sheet throws — don't nag them.
      if (err instanceof Error && err.name === 'NotAllowedError') return;
      toast.error(err instanceof Error ? err.message : 'Setup failed');
    } finally {
      setBusy(false);
    }
  }

  async function removePasskey(id: string) {
    if (!confirm('Remove this passkey? You can set it up again anytime.')) return;
    setBusy(true);
    try {
      const res = await fetch('/api/auth/webauthn/passkeys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error('Failed to remove');
      toast.success('Passkey removed');
      setPasskeys((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove');
    } finally {
      setBusy(false);
    }
  }

  if (!supported) {
    return (
      <p className="text-sm text-muted-foreground">
        This device doesn&apos;t support passkeys. On iPhone, add the app to your home screen
        and open it from there.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {loaded && passkeys.length > 0 && (
        <ul className="space-y-2">
          {passkeys.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{p.device_label ?? 'Passkey'}</p>
                <p className="text-xs text-muted-foreground">
                  Added {format(parseISO(p.created_at), 'MMM d, yyyy')}
                  {p.last_used_at
                    ? ` · last used ${format(parseISO(p.last_used_at), 'MMM d')}`
                    : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removePasskey(p.id)}
                disabled={busy}
                className="shrink-0 text-muted-foreground hover:text-destructive"
                aria-label="Remove passkey"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Button type="button" variant="outline" onClick={addPasskey} disabled={busy} className="w-full">
        <Fingerprint size={16} />
        {passkeys.length > 0 ? 'Add another device' : 'Enable Face ID / passkey'}
      </Button>
      <BusyBar active={busy} />
    </div>
  );
}
