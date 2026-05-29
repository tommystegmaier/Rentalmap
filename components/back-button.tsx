'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

// Goes back exactly one page in history (where the user just came from). Falls
// back to a sensible parent route when there's no in-app history — e.g. when
// the page was opened directly from a push notification or a fresh tab.
export function BackButton({
  fallback = '/',
  label = 'Back',
}: {
  fallback?: string;
  label?: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== 'undefined' && window.history.length > 1) {
          router.back();
        } else {
          router.push(fallback);
        }
      }}
      className="flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground"
    >
      <ChevronLeft size={16} />
      {label}
    </button>
  );
}
