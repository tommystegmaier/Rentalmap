'use client';

import { useEffect, useState } from 'react';
import { Logo } from '@/components/logo';

type Phase = 'in' | 'out' | 'done';

export function SplashScreen({ subtitle }: { subtitle?: string }) {
  const [phase, setPhase] = useState<Phase | null>(null);

  useEffect(() => {
    if (sessionStorage.getItem('splash-shown')) {
      setPhase('done');
      return;
    }
    sessionStorage.setItem('splash-shown', '1');
    setPhase('in');

    const outTimer = setTimeout(() => setPhase('out'), 1400);
    const doneTimer = setTimeout(() => setPhase('done'), 1850);
    return () => {
      clearTimeout(outTimer);
      clearTimeout(doneTimer);
    };
  }, []);

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
      <div className="flex flex-col items-center gap-4 px-8 text-center">
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
        {subtitle && (
          <span
            className="text-sm font-medium text-muted-foreground"
            style={{
              opacity: 0,
              animation: 'splash-wordmark-in 0.4s ease-out 0.6s forwards',
            }}
          >
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
