'use client';

import { useEffect } from 'react';

export function AppBadgeSync({ count }: { count: number }) {
  useEffect(() => {
    if (!('setAppBadge' in navigator)) return;
    if (count > 0) {
      navigator.setAppBadge(count).catch(() => {});
    } else {
      navigator.clearAppBadge().catch(() => {});
    }
  }, [count]);

  return null;
}
