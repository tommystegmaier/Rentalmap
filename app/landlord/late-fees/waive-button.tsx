'use client';

import { useState } from 'react';
import { waiveLateFee } from './actions';

export function WaiveLateFeeButton({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);

  async function handle() {
    const note = prompt('Optional note for waiving this fee (or leave blank):') ?? '';
    if (note === null) return; // cancelled
    setBusy(true);
    try {
      await waiveLateFee(id, note);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={handle}
      disabled={busy}
      className="rounded border px-2 py-1 text-xs text-muted-foreground transition hover:border-destructive hover:text-destructive disabled:opacity-50"
    >
      Waive
    </button>
  );
}
