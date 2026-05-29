'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, Plus } from 'lucide-react';
import { BusyBar } from '@/components/busy-bar';
import { updateDeposit } from './actions';

type DepositStatus =
  | 'holding'
  | 'returned'
  | 'partially_returned'
  | 'applied_to_damages'
  | 'forfeited';

interface DeductionItem {
  label: string;
  amount_cents: number;
}

interface UpdateDepositFormProps {
  depositId: string;
  initialStatus: DepositStatus;
  initialReturnedDate: string | null;
  initialReturnedAmountCents: number | null;
  initialHoldingInstitution: string | null;
  initialNotes: string | null;
  initialDeductionItems: DeductionItem[] | null;
}

export function UpdateDepositForm({
  depositId,
  initialStatus,
  initialReturnedDate,
  initialReturnedAmountCents,
  initialHoldingInstitution,
  initialNotes,
  initialDeductionItems,
}: UpdateDepositFormProps) {
  const router = useRouter();
  const [status, setStatus] = useState<DepositStatus>(initialStatus);
  const [returnedDate, setReturnedDate] = useState(
    initialReturnedDate ?? '',
  );
  const [returnedAmount, setReturnedAmount] = useState(
    initialReturnedAmountCents != null
      ? (initialReturnedAmountCents / 100).toFixed(2)
      : '',
  );
  const [holdingInstitution, setHoldingInstitution] = useState(
    initialHoldingInstitution ?? '',
  );
  const [notes, setNotes] = useState(initialNotes ?? '');
  const [deductions, setDeductions] = useState<{ label: string; amount: string }[]>(
    (initialDeductionItems ?? []).map((d) => ({
      label: d.label,
      amount: (d.amount_cents / 100).toFixed(2),
    })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const showReturnFields =
    status === 'returned' ||
    status === 'partially_returned' ||
    status === 'applied_to_damages' ||
    status === 'forfeited';

  const showDeductions =
    status === 'partially_returned' || status === 'applied_to_damages';

  function addDeduction() {
    setDeductions((prev) => [...prev, { label: '', amount: '' }]);
  }

  function removeDeduction(index: number) {
    setDeductions((prev) => prev.filter((_, i) => i !== index));
  }

  function updateDeductionField(
    index: number,
    field: 'label' | 'amount',
    value: string,
  ) {
    setDeductions((prev) =>
      prev.map((d, i) => (i === index ? { ...d, [field]: value } : d)),
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);

    try {
      const fd = new FormData();
      fd.set('status', status);
      fd.set('returned_date', returnedDate);
      fd.set('returned_amount', returnedAmount);
      fd.set('holding_institution', holdingInstitution);
      fd.set('notes', notes);

      for (const d of deductions) {
        fd.append('deduction_label', d.label);
        fd.append('deduction_amount', d.amount);
      }

      await updateDeposit(depositId, fd);
      setSaved(true);
      toast.success('Deposit updated');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <Select
          id="status"
          value={status}
          onChange={(e) => setStatus(e.target.value as DepositStatus)}
        >
          <option value="holding">Holding</option>
          <option value="returned">Returned</option>
          <option value="partially_returned">Partially returned</option>
          <option value="applied_to_damages">Applied to damages</option>
          <option value="forfeited">Forfeited</option>
        </Select>
      </div>

      {showReturnFields && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="returned_date">Return date</Label>
            <Input
              id="returned_date"
              type="date"
              value={returnedDate}
              onChange={(e) => setReturnedDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="returned_amount">Amount returned ($)</Label>
            <Input
              id="returned_amount"
              inputMode="decimal"
              placeholder="0.00"
              value={returnedAmount}
              onChange={(e) => setReturnedAmount(e.target.value)}
            />
          </div>
        </div>
      )}

      {showDeductions && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Deductions</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addDeduction}
            >
              <Plus size={14} /> Add deduction
            </Button>
          </div>
          {deductions.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No deductions added yet. Click &ldquo;Add deduction&rdquo; to itemise damages.
            </p>
          )}
          {deductions.map((d, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <Label htmlFor={`deduction-label-${i}`} className="text-xs">
                  Description
                </Label>
                <Input
                  id={`deduction-label-${i}`}
                  placeholder="e.g. Broken window"
                  value={d.label}
                  onChange={(e) => updateDeductionField(i, 'label', e.target.value)}
                />
              </div>
              <div className="w-28 space-y-1">
                <Label htmlFor={`deduction-amount-${i}`} className="text-xs">
                  Amount ($)
                </Label>
                <Input
                  id={`deduction-amount-${i}`}
                  inputMode="decimal"
                  placeholder="0.00"
                  value={d.amount}
                  onChange={(e) => updateDeductionField(i, 'amount', e.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => removeDeduction(i)}
                className="mb-0.5 text-destructive hover:bg-destructive/10"
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="holding_institution">Holding institution (optional)</Label>
        <Input
          id="holding_institution"
          placeholder="e.g. Chase escrow account"
          value={holdingInstitution}
          onChange={(e) => setHoldingInstitution(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && (
        <p className="text-sm text-green-600">Changes saved.</p>
      )}

      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? 'Saving…' : 'Save changes'}
      </Button>
      <BusyBar active={busy} />
    </form>
  );
}
