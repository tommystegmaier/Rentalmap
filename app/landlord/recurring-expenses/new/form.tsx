'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BusyBar } from '@/components/busy-bar';
import { EXPENSE_CATEGORIES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { createRecurringExpense, updateRecurringExpense } from '../actions';

const FREQUENCIES = ['monthly', 'quarterly', 'annually'] as const;
type Frequency = (typeof FREQUENCIES)[number];
const FREQ_LABELS: Record<Frequency, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annually: 'Annually',
};

export interface RecurringExpenseInitial {
  id: string;
  propertyId: string;
  amountCents: number;
  category: string;
  vendor: string | null;
  notes: string | null;
  taxDeductible: boolean;
  frequency: Frequency;
  nextDueDate: string;
}

interface Props {
  properties: { id: string; address: string }[];
  initial?: RecurringExpenseInitial;
}

export function RecurringExpenseForm({ properties, initial }: Props) {
  const router = useRouter();
  const editing = !!initial;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [propertyId, setPropertyId] = useState(initial?.propertyId ?? properties[0]?.id ?? '');
  const [amount, setAmount] = useState(initial ? String(initial.amountCents / 100) : '');
  const [category, setCategory] = useState<(typeof EXPENSE_CATEGORIES)[number]>(
    (initial?.category as (typeof EXPENSE_CATEGORIES)[number]) ?? 'Mortgage Interest',
  );
  const [vendor, setVendor] = useState(initial?.vendor ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [taxDeductible, setTaxDeductible] = useState(initial?.taxDeductible ?? true);
  const [frequency, setFrequency] = useState<Frequency>(initial?.frequency ?? 'monthly');
  const [nextDueDate, setNextDueDate] = useState(initial?.nextDueDate ?? '');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!propertyId || !amount || !nextDueDate) {
      setError('Please fill in all required fields.');
      return;
    }
    const amountCents = Math.round(parseFloat(amount) * 100);
    if (isNaN(amountCents) || amountCents <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = {
        propertyId,
        amountCents,
        category,
        vendor: vendor.trim() || null,
        notes: notes.trim() || null,
        taxDeductible,
        frequency,
        nextDueDate,
      };
      if (editing) {
        await updateRecurringExpense(initial.id, payload);
        toast.success('Recurring expense updated');
      } else {
        await createRecurringExpense(payload);
        toast.success('Recurring expense created');
      }
      router.push('/landlord/recurring-expenses');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="property">Property</Label>
        <select
          id="property"
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          required
        >
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.address}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="category">Category</Label>
        <select
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value as (typeof EXPENSE_CATEGORIES)[number])}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="vendor">Vendor</Label>
        <Input
          id="vendor"
          value={vendor}
          onChange={(e) => setVendor(e.target.value)}
          placeholder="e.g. Wells Fargo, State Farm"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="amount">Amount</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
          <Input
            id="amount"
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="pl-7"
            placeholder="0.00"
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Frequency</Label>
        <div className="flex gap-1 rounded-lg border p-1">
          {FREQUENCIES.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFrequency(f)}
              className={cn(
                'flex flex-1 items-center justify-center rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
                frequency === f
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {FREQ_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="next-due">{editing ? 'Next occurrence' : 'First occurrence'}</Label>
        <Input
          id="next-due"
          type="date"
          value={nextDueDate}
          onChange={(e) => setNextDueDate(e.target.value)}
          required
        />
        {!editing && (
          <p className="text-xs text-muted-foreground">
            The expense will auto-post on this date, then repeat {FREQ_LABELS[frequency].toLowerCase()}.
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          id="tax"
          type="checkbox"
          checked={taxDeductible}
          onChange={(e) => setTaxDeductible(e.target.checked)}
          className="h-4 w-4"
        />
        <Label htmlFor="tax">Tax deductible</Label>
      </div>

      <div className="space-y-1">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes"
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? 'Saving…' : editing ? 'Save changes' : 'Create recurring expense'}
      </Button>
      <BusyBar active={busy} />
    </form>
  );
}
