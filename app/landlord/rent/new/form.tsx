'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { BusyBar } from '@/components/busy-bar';
import { logRentPayment } from './actions';

export interface LeaseOption {
  id: string;
  monthly_rent_cents: number;
  address: string;
}

export function RentPaymentForm({ leases }: { leases: LeaseOption[] }) {
  const router = useRouter();
  const [leaseId, setLeaseId] = useState(leases[0]?.id ?? '');
  const [amount, setAmount] = useState(
    leases[0] ? (leases[0].monthly_rent_cents / 100).toFixed(2) : '',
  );
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState('zelle');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleLeaseChange(id: string) {
    setLeaseId(id);
    const lease = leases.find((l) => l.id === id);
    if (lease) setAmount((lease.monthly_rent_cents / 100).toFixed(2));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set('lease_id', leaseId);
      fd.set('amount', amount);
      fd.set('received_date', date);
      fd.set('method', method);
      fd.set('notes', notes);
      await logRentPayment(fd);
      router.push('/landlord/rent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="lease">Lease</Label>
        <Select
          id="lease"
          value={leaseId}
          onChange={(e) => handleLeaseChange(e.target.value)}
        >
          {leases.map((l) => (
            <option key={l.id} value={l.id}>
              {l.address} (${(l.monthly_rent_cents / 100).toFixed(0)}/mo)
            </option>
          ))}
        </Select>
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
          <Label htmlFor="date">Received date</Label>
          <Input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="method">Method</Label>
        <Select
          id="method"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
        >
          <option value="zelle">Zelle</option>
          <option value="venmo">Venmo</option>
          <option value="cashapp">Cash App</option>
          <option value="check">Check</option>
          <option value="cash">Cash</option>
          <option value="other">Other</option>
        </Select>
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
        {busy ? 'Saving…' : 'Save payment'}
      </Button>
      <BusyBar active={busy} />
    </form>
  );
}
