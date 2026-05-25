'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    let reloaded = false;

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        // Check for an updated service worker on every load.
        reg.update().catch(() => {});

        reg.addEventListener('updatefound', () => {
          const next = reg.installing;
          if (!next) return;
          next.addEventListener('statechange', () => {
            // A new SW just took over an existing controller — reload once
            // so the user sees the latest version of the app.
            if (
              next.state === 'activated' &&
              navigator.serviceWorker.controller &&
              !reloaded
            ) {
              reloaded = true;
              window.location.reload();
            }
          });
        });
      })
      .catch(() => {});
  }, []);

  return null;
}
