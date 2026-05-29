'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

export function SuccessToast({ show, message }: { show: boolean; message: string }) {
  const fired = useRef(false);
  useEffect(() => {
    if (show && !fired.current) {
      fired.current = true;
      toast.success(message);
      const url = new URL(window.location.href);
      if (url.searchParams.has('saved')) {
        url.searchParams.delete('saved');
        window.history.replaceState({}, '', url.pathname + (url.search || ''));
      }
    }
  }, [show, message]);
  return null;
}
