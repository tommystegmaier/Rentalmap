'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Share, X, Plus } from 'lucide-react';

const STORAGE_KEY = 'pwa_install_dismissed';

function isStandalone() {
  return (
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true)
  );
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(
    typeof navigator !== 'undefined' ? navigator.userAgent : '',
  );
}

export function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<Event & {
    prompt: () => void;
    userChoice: Promise<{ outcome: string }>;
  } | null>(null);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(STORAGE_KEY)) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as never);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // On iOS, beforeinstallprompt never fires — show our own instructions.
    if (isIOS()) setShow(true);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1');
    setShow(false);
  }

  async function install() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') dismiss();
    }
  }

  if (!show) return null;

  const ios = isIOS();

  return (
    <div className="fixed inset-x-0 bottom-20 z-50 px-4">
      <div className="rounded-2xl border bg-card p-4 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-sm font-semibold">Add It Rents to your home screen</p>
            {ios ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Tap{' '}
                <span className="inline-flex items-center gap-0.5 font-medium text-foreground">
                  <Share size={11} className="shrink-0" /> Share
                </span>
                {' '}then{' '}
                <span className="inline-flex items-center gap-0.5 font-medium text-foreground">
                  <Plus size={11} className="shrink-0" /> Add to Home Screen
                </span>
                {' '}for one-tap access.
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                Install the app for one-tap access — no App Store needed.
              </p>
            )}
          </div>
          <button
            onClick={dismiss}
            className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted"
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </div>

        {!ios && deferredPrompt && (
          <Button size="sm" className="mt-3 w-full" onClick={install}>
            Install app
          </Button>
        )}

        <button
          onClick={dismiss}
          className="mt-2 w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Don't show again
        </button>
      </div>
    </div>
  );
}
