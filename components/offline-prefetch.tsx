'use client';

import { useEffect } from 'react';

// Tells the service worker to pre-cache a set of page URLs while we're online,
// so they're available offline even if the user never opened them (e.g. a
// landlord driving to a property they hadn't tapped into yet).
export function OfflinePrefetch({ urls }: { urls: string[] }) {
  useEffect(() => {
    if (urls.length === 0) return;
    if (typeof navigator === 'undefined' || !navigator.onLine) return;
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.ready
      .then((reg) => {
        reg.active?.postMessage({ type: 'PRECACHE_PAGES', urls });
      })
      .catch(() => {});
  }, [urls]);

  return null;
}
