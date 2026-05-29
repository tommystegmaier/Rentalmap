'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Trash2 } from 'lucide-react';
import { saveTaxSchedule, deleteTaxReport } from './actions';

export function DeleteTaxReportButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      aria-label="Delete report"
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!confirm('Delete this tax report? This cannot be undone.')) return;
        setBusy(true);
        try {
          await deleteTaxReport(id);
          toast.success('Report deleted');
          router.refresh();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Failed to delete');
          setBusy(false);
        }
      }}
      className="shrink-0 rounded-md p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
    >
      <Trash2 size={15} />
    </button>
  );
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function TaxYearPicker({ year, years }: { year: number; years: number[] }) {
  const router = useRouter();
  return (
    <Select
      aria-label="Tax year"
      value={String(year)}
      onChange={(e) => router.push(`/landlord/tax?year=${e.target.value}`)}
    >
      {years.map((y) => (
        <option key={y} value={y}>
          {y}
        </option>
      ))}
    </Select>
  );
}

export function TaxScheduleSettings({
  initialEnabled,
  initialMonth,
  initialDay,
}: {
  initialEnabled: boolean;
  initialMonth: number;
  initialDay: number;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [month, setMonth] = useState(initialMonth);
  const [day, setDay] = useState(initialDay);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await saveTaxSchedule(enabled, month, day);
      toast.success(
        enabled
          ? `Scheduled for ${MONTHS[month - 1]} ${day} each year`
          : 'Scheduled report turned off',
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  }

  const daysInMonth = new Date(2024, month, 0).getDate();

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4"
        />
        <span className="text-sm font-medium">Automatically generate a tax report each year</span>
      </label>

      {enabled ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="tax-month" className="text-xs">Month</Label>
            <Select
              id="tax-month"
              value={String(month)}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="tax-day" className="text-xs">Day</Label>
            <Select
              id="tax-day"
              value={String(Math.min(day, daysInMonth))}
              onChange={(e) => setDay(Number(e.target.value))}
            >
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </div>
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        On the scheduled date we generate the report for the <strong>previous</strong> tax year,
        save it here, and send you a notification.
      </p>

      <Button onClick={save} disabled={busy} size="sm">
        {busy ? 'Saving…' : 'Save schedule'}
      </Button>
    </div>
  );
}
