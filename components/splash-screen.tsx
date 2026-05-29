'use client';

import { useEffect, useState } from 'react';
import { Logo } from '@/components/logo';

type Phase = 'in' | 'out' | 'done';

export function SplashScreen({ subtitle }: { subtitle?: string }) {
  // Default to 'in' so the overlay is present on the very first render,
  // preventing any flash of the home screen behind it.
  const [phase, setPhase] = useState<Phase>('in');

  useEffect(() => {
    if (sessionStorage.getItem('splash-shown')) {
      setPhase('done');
      return;
    }
    sessionStorage.setItem('splash-shown', '1');

    const outTimer = setTimeout(() => setPhase('out'), 2800);
    const doneTimer = setTimeout(() => setPhase('done'), 3700);
    return () => {
      clearTimeout(outTimer);
      clearTimeout(doneTimer);
    };
  }, []);

  if (phase === 'done') return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background"
      style={
        phase === 'out'
          ? { animation: 'splash-fade-out 0.9s ease-in forwards' }
          : undefined
      }
    >
      <div className="flex flex-col items-center gap-4 px-8 text-center">
        <div
          style={{
            animation: 'splash-logo-in 1.1s cubic-bezier(0.34, 1.4, 0.64, 1) forwards',
          }}
        >
          <Logo size={72} />
        </div>
        <span
          className="text-2xl font-bold tracking-tight text-foreground"
          style={{
            opacity: 0,
            animation: 'splash-wordmark-in 0.8s ease-out 0.6s forwards',
          }}
        >
          It Rents
        </span>
        {subtitle && (
          <span
            className="text-sm font-medium text-muted-foreground"
            style={{
              opacity: 0,
              animation: 'splash-wordmark-in 0.8s ease-out 1.2s forwards',
            }}
          >
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
