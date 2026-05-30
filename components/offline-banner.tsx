'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

// Slim banner that appears when the device loses connectivity, so users know
// why new data/actions aren't working.
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-warning px-4 py-1.5 text-center text-xs font-medium text-warning-foreground">
      <WifiOff size={13} />
      You&apos;re offline — showing saved data
    </div>
  );
}
