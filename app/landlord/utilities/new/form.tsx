'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { parseDollarsToCents } from '@/lib/utils';
import { createUtilityBill, type UtilityType, type PaidBy } from './actions';
import { BusyBar } from '@/components/busy-bar';

const UTILITY_TYPES: { value: UtilityType; label: string }[] = [
  { value: 'electric', label: 'Electric' },
  { value: 'gas', label: 'Gas' },
  { value: 'water', label: 'Water' },
  { value: 'sewer', label: 'Sewer' },
  { value: 'trash', label: 'Trash' },
  { value: 'internet', label: 'Internet' },
  { value: 'cable', label: 'Cable/TV' },
  { value: 'other', label: 'Other' },
];

const PAID_BY_OPTIONS: { value: PaidBy; label: string }[] = [
  { value: 'landlord', label: 'Landlord' },
  { value: 'tenant', label: 'Tenant' },
  { value: 'shared', label: 'Shared' },
];

interface UtilityBillFormProps {
  properties: { id: string; address: string }[];
  initialPropertyId?: string;
  /** If set, redirect here after save instead of the utilities list */
  returnPropertyId?: string;
}

export function UtilityBillForm({ properties, initialPropertyId, returnPropertyId }: UtilityBillFormProps) {
  const [propertyId, setPropertyId] = useState(
    initialPropertyId ?? properties[0]?.id ?? '',
  );
  const [utilityType, setUtilityType] = useState<UtilityType>('electric');
  const [providerName, setProviderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [billingStart, setBillingStart] = useState('');
  const [billingEnd, setBillingEnd] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState<PaidBy>('landlord');
  const [dueDate, setDueDate] = useState('');
  const [paidDate, setPaidDate] = useState('');
  const [notes, setNotes] = useState('');
  const [alsoLogAsExpense, setAlsoLogAsExpense] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const cents = parseDollarsToCents(amount);
    if (!cents || cents <= 0) {
      setError('Enter a valid amount.');
      setBusy(false);
      return;
    }

    try {
      await createUtilityBill({
        property_id: propertyId,
        utility_type: utilityType,
        provider_name: providerName || null,
        account_number: accountNumber || null,
        billing_period_start: billingStart || null,
        billing_period_end: billingEnd || null,
        amount_cents: cents,
        paid_by: paidBy,
        due_date: dueDate || null,
        paid_date: paidDate || null,
        notes: notes || null,
        also_log_as_expense: alsoLogAsExpense,
        return_property_id: returnPropertyId ?? null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="property">Property</Label>
        <Select
          id="property"
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
        >
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.address}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="utility_type">Utility type</Label>
        <Select
          id="utility_type"
          value={utilityType}
          onChange={(e) => setUtilityType(e.target.value as UtilityType)}
        >
          {UTILITY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="provider_name">Provider (optional)</Label>
          <Input
            id="provider_name"
            value={providerName}
            onChange={(e) => setProviderName(e.target.value)}
            placeholder="e.g. PG&E"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="account_number">Account # (optional)</Label>
          <Input
            id="account_number"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="billing_start">Billing period start</Label>
          <Input
            id="billing_start"
            type="date"
            value={billingStart}
            onChange={(e) => setBillingStart(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="billing_end">Billing period end</Label>
          <Input
            id="billing_end"
            type="date"
            value={billingEnd}
            onChange={(e) => setBillingEnd(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="amount">Amount ($)</Label>
          <Input
            id="amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            placeholder="0.00"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="paid_by">Paid by</Label>
          <Select
            id="paid_by"
            value={paidBy}
            onChange={(e) => setPaidBy(e.target.value as PaidBy)}
          >
            {PAID_BY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="due_date">Due date (optional)</Label>
          <Input
            id="due_date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="paid_date">Paid date (optional)</Label>
          <Input
            id="paid_date"
            type="date"
            value={paidDate}
            onChange={(e) => setPaidDate(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea
          id="notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={alsoLogAsExpense}
          onChange={(e) => setAlsoLogAsExpense(e.target.checked)}
          className="h-4 w-4 rounded border-input"
        />
        Also log as an expense record
      </label>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? 'Saving…' : 'Save bill'}
      </Button>
      <BusyBar active={busy} />
    </form>
  );
}
