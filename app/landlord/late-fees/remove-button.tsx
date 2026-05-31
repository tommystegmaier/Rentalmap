'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { waiveLateFee } from './actions';
import { X } from 'lucide-react';

export function RemoveLateFeeButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await waiveLateFee(id, note);
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  if (!open) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs text-destructive hover:border-destructive hover:bg-destructive/5"
        onClick={() => setOpen(true)}
      >
        Remove
      </Button>
    );
  }

  return (
    <div className="mt-2 w-full rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-destructive">Remove this late fee?</p>
        <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
          <X size={14} />
        </button>
      </div>
      <Textarea
        placeholder="Optional note (e.g. tenant paid early, one-time exception)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        className="text-sm"
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="destructive"
          className="flex-1 h-7 text-xs"
          disabled={busy}
          onClick={confirm}
        >
          {busy ? 'Removing…' : 'Yes, remove fee'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          disabled={busy}
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
