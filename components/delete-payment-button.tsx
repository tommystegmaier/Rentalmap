'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { deletePayment } from '@/app/landlord/rent/actions';

export function DeletePaymentButton({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!confirm('Delete this payment record? This cannot be undone.')) return;
    setBusy(true);
    try {
      await deletePayment(id);
    } catch {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={busy}
      className="rounded p-1 text-muted-foreground transition hover:text-destructive disabled:opacity-50"
      title="Delete payment"
    >
      <Trash2 size={14} />
    </button>
  );
}
