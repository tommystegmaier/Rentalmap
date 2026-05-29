'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { deleteWorkOrder } from '@/app/landlord/maintenance/[id]/actions';
import { BusyBar } from '@/components/busy-bar';

export function DeleteWorkOrderButton({
  id,
  redirectTo,
}: {
  id: string;
  redirectTo: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (!confirm('Delete this work order? This cannot be undone.')) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteWorkOrder(id);
        router.push(redirectTo);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete work order.');
      }
    });
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        className="w-full text-destructive"
        onClick={handleDelete}
        disabled={isPending}
      >
        <Trash2 size={14} className="mr-1" />
        {isPending ? 'Deleting…' : 'Delete work order'}
      </Button>
      <BusyBar active={isPending} />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
