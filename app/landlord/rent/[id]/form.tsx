'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { BusyBar } from '@/components/busy-bar';
import { updateRentPayment } from './actions';
import type { RentPeriodOption } from '@/lib/rent-period';

interface PaymentData {
  id: string;
  amount_cents: number;
  expected_date: string;
  received_date: string | null;
  method: string | null;
  status: string;
  notes: string | null;
}

interface Props {
  payment: PaymentData;
  periodOptions: RentPeriodOption[];
}

export function EditPaymentForm({ payment, periodOptions }: Props) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(payment.expected_date);
  const [amount, setAmount] = useState((payment.amount_cents / 100).toFixed(2));
  const [receivedDate, setReceivedDate] = useState(payment.received_date ?? '');
  const [method, setMethod] = useState(payment.method ?? 'other');
  const [status, setStatus] = useState(payment.status);
  const [notes, setNotes] = useState(payment.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedOption = periodOptions.find((o) => o.value === selectedDate);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set('expected_date', selectedDate);
      fd.set('amount', amount);
      fd.set('received_date', receivedDate);
      fd.set('method', method);
      fd.set('status', status);
      fd.set('notes', notes);
      await updateRentPayment(payment.id, fd);
      router.push('/landlord/rent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Period (which month this payment is for)</Label>
        <Select
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        >
          {periodOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}{opt.paid ? ' · paid' : ''}
            </option>
          ))}
        </Select>
        {selectedOption?.paid ? (
          <p className="text-xs text-warning">
            This period already has another payment on record — a duplicate will be saved.
          </p>
        ) : null}
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
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="received_date">Received date</Label>
          <Input
            id="received_date"
            type="date"
            value={receivedDate}
            onChange={(e) => setReceivedDate(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="method">Method</Label>
          <Select
            id="method"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          >
            <option value="ach">ACH / Bank</option>
            <option value="card">Card</option>
            <option value="zelle">Zelle</option>
            <option value="venmo">Venmo</option>
            <option value="cashapp">Cash App</option>
            <option value="check">Check</option>
            <option value="cash">Cash</option>
            <option value="other">Other</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="manual">Manual (confirmed)</option>
            <option value="settled">Settled (Stripe)</option>
            <option value="pending">Pending</option>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea
          id="notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? 'Saving…' : 'Save changes'}
      </Button>
      <BusyBar active={busy} />
    </form>
  );
}
