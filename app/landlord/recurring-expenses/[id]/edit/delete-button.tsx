'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { BusyBar } from '@/components/busy-bar';
import { deleteRecurringExpense } from '../../actions';

export function DeleteRecurringExpenseButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm('Delete this recurring expense? Future auto-posts will stop.')) return;
    setBusy(true);
    setError(null);
    try {
      await deleteRecurringExpense(id);
      router.push('/landlord/recurring-expenses');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        className="w-full text-destructive"
        onClick={handleDelete}
        disabled={busy}
      >
        {busy ? 'Deleting…' : 'Delete recurring expense'}
      </Button>
      <BusyBar active={busy} />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
