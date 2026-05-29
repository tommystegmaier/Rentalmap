'use client';

import { useEffect, useState } from 'react';
import { Logo } from '@/components/logo';

type Phase = 'in' | 'out' | 'done';

export function SplashScreen() {
  const [phase, setPhase] = useState<Phase | null>(null);

  useEffect(() => {
    // Only show once per session (each PWA launch = new session).
    if (sessionStorage.getItem('splash-shown')) {
      setPhase('done');
      return;
    }
    sessionStorage.setItem('splash-shown', '1');
    setPhase('in');

    const outTimer = setTimeout(() => setPhase('out'), 1200);
    const doneTimer = setTimeout(() => setPhase('done'), 1650);
    return () => {
      clearTimeout(outTimer);
      clearTimeout(doneTimer);
    };
  }, []);

  // Render nothing until effect runs (avoids SSR flash).
  if (phase === null || phase === 'done') return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background"
      style={
        phase === 'out'
          ? { animation: 'splash-fade-out 0.45s ease-in forwards' }
          : undefined
      }
    >
      <div className="flex flex-col items-center gap-4">
        <div
          style={{
            animation: 'splash-logo-in 0.55s cubic-bezier(0.34, 1.4, 0.64, 1) forwards',
          }}
        >
          <Logo size={72} />
        </div>
        <span
          className="text-2xl font-bold tracking-tight text-foreground"
          style={{
            opacity: 0,
            animation: 'splash-wordmark-in 0.4s ease-out 0.3s forwards',
          }}
        >
          It Rents
        </span>
      </div>
    </div>
  );
}
