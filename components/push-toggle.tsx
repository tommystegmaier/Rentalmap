'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { BusyBar } from '@/components/busy-bar';

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Returns the iOS major version, or null on non-iOS devices. */
function iOSVersion(): number | null {
  const m = navigator.userAgent.match(/OS (\d+)_/);
  return m ? parseInt(m[1], 10) : null;
}

export function PushToggle({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Reason why push isn't supported — used for the unsupported message.
  const [unsupportedReason, setUnsupportedReason] = useState<'ios-old' | 'not-standalone' | 'browser' | null>(null);

  useEffect(() => {
    const hasPush =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      typeof Notification !== 'undefined';

    if (!hasPush) {
      // Distinguish between iOS < 16.4 and a plain unsupported browser.
      const ios = iOSVersion();
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as { standalone?: boolean }).standalone === true;

      if (ios !== null && ios < 16) {
        setUnsupportedReason('ios-old');
      } else if (ios !== null && !isStandalone) {
        setUnsupportedReason('not-standalone');
      } else {
        setUnsupportedReason('browser');
      }
      return;
    }

    setSupported(true);
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setEnabled(!!sub))
      .catch(() => {});
  }, []);

  async function enable() {
    if (!vapidPublicKey) {
      setError('Push notifications are not configured on the server yet.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setError('Notifications were not allowed.');
        return;
      }
      const reg = await navigator.serviceWorker.register('/sw.js');
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error ?? 'Failed to register');
      }
      setEnabled(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setEnabled(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  if (!supported) {
    const message =
      unsupportedReason === 'ios-old'
        ? 'Push notifications require iOS 16.4 or later. Update your iPhone to enable them.'
        : unsupportedReason === 'not-standalone'
          ? 'To enable notifications on iPhone, add this app to your Home Screen first, then open it from there.'
          : 'Push notifications aren\'t supported in this browser.';

    return <p className="text-sm text-muted-foreground">{message}</p>;
  }

  return (
    <div className="space-y-2">
      {enabled ? (
        <Button variant="outline" onClick={disable} disabled={busy}>
          {busy ? 'Working…' : 'Turn off notifications'}
        </Button>
      ) : (
        <Button onClick={enable} disabled={busy}>
          {busy ? 'Working…' : 'Enable notifications'}
        </Button>
      )}
      <BusyBar active={busy} />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
