'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { markLateFeePaid } from './actions';

export function MarkLateFeePaidButton({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);

  async function handle() {
    if (!confirm('Mark this late fee as paid? Use this for fees collected outside the app (cash, check, etc.).')) {
      return;
    }
    setBusy(true);
    try {
      await markLateFeePaid(id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="h-7 text-xs text-success hover:border-success hover:bg-success/5"
      disabled={busy}
      onClick={handle}
    >
      {busy ? 'Saving…' : 'Mark paid'}
    </Button>
  );
}
