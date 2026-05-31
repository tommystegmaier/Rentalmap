'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Bell, X } from 'lucide-react';

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const DISMISSED_KEY = 'push_prompt_v1_dismissed';
const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

export function TenantPushPrompt() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    const supported =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      typeof Notification !== 'undefined';
    const dismissed = localStorage.getItem(DISMISSED_KEY) === '1';
    // Guard: Notification may be undefined on older iOS / non-push browsers.
    const alreadyDecided = supported && Notification.permission !== 'default';

    if (isStandalone && supported && !dismissed && !alreadyDecided) {
      // Small delay so the page renders first.
      const t = setTimeout(() => setShow(true), 1500);
      return () => clearTimeout(t);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1');
    setShow(false);
  }

  async function enable() {
    if (!VAPID_KEY) {
      dismiss();
      return;
    }
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        const reg = await navigator.serviceWorker.register('/sw.js');
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_KEY),
        });
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sub),
        });
      }
    } catch {
      // silently ignore — user can always enable from profile
    } finally {
      setBusy(false);
      dismiss();
    }
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-20 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 animate-in slide-in-from-bottom-4 rounded-2xl border bg-card p-4 shadow-xl">
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-muted"
      >
        <X size={16} />
      </button>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Bell size={20} />
        </div>
        <div className="flex-1 space-y-2 pr-4">
          <p className="font-semibold leading-snug">Stay in the loop</p>
          <p className="text-sm text-muted-foreground">
            Get notified about rent reminders, maintenance updates, and lease signing requests —
            right on your phone.
          </p>
          <div className="flex gap-2 pt-1">
            <Button onClick={enable} disabled={busy} size="sm" className="flex-1">
              {busy ? 'Enabling…' : 'Allow notifications'}
            </Button>
            <Button onClick={dismiss} size="sm" variant="ghost" className="shrink-0">
              Not now
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
