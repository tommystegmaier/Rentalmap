'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { Select } from '@/components/ui/select';
import { deleteMileageTrip } from './actions';

export function MileageYearPicker({ year, years }: { year: number; years: number[] }) {
  const router = useRouter();
  return (
    <Select
      aria-label="Mileage year"
      value={String(year)}
      onChange={(e) => router.push(`/landlord/mileage?year=${e.target.value}`)}
    >
      {years.map((y) => (
        <option key={y} value={y}>
          {y}
        </option>
      ))}
    </Select>
  );
}

export function DeleteMileageButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      aria-label="Delete trip"
      onClick={async () => {
        if (!confirm('Delete this trip? This cannot be undone.')) return;
        setBusy(true);
        try {
          await deleteMileageTrip(id);
          toast.success('Trip deleted');
          router.refresh();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Failed to delete');
          setBusy(false);
        }
      }}
      className="shrink-0 rounded-md p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
    >
      <Trash2 size={15} />
    </button>
  );
}
