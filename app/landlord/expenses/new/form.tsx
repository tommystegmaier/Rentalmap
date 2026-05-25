'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { EXPENSE_CATEGORIES } from '@/lib/constants';
import { parseDollarsToCents } from '@/lib/utils';

interface ExpenseFormProps {
  properties: { id: string; address: string }[];
}

export function ExpenseForm({ properties }: ExpenseFormProps) {
  const router = useRouter();
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? '');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<(typeof EXPENSE_CATEGORIES)[number]>('Repairs');
  const [vendor, setVendor] = useState('');
  const [notes, setNotes] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleScan() {
    if (!receipt) {
      setError('Pick a receipt photo first.');
      return;
    }
    setScanning(true);
    setError(null);
    setScanMessage(null);
    try {
      const fd = new FormData();
      fd.append('file', receipt);
      const res = await fetch('/api/expenses/scan', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Scan failed');
      setAmount(typeof json.amount === 'number' ? json.amount.toFixed(2) : '');
      setVendor(json.vendor ?? '');
      if (json.date) setDate(json.date);
      if (json.category && (EXPENSE_CATEGORIES as readonly string[]).includes(json.category)) {
        setCategory(json.category);
      }
      if (json.description) {
        setNotes((prev) => (prev ? `${prev}\n${json.description}` : json.description));
      }
      setScanMessage(
        'Fields filled in from the photo. Review and tweak anything that looks off before saving.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  }

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
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let receipt_url: string | null = null;
      if (receipt) {
        const ext = receipt.name.split('.').pop() ?? 'jpg';
        const path = `${propertyId}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('receipts')
          .upload(path, receipt, { upsert: false });
        if (uploadErr) throw uploadErr;
        receipt_url = path;
      }

      const { error: insertErr } = await supabase.from('expenses').insert({
        property_id: propertyId,
        date,
        amount_cents: cents,
        category,
        vendor: vendor || null,
        notes: notes || null,
        receipt_url,
        created_by: user.id,
      });
      if (insertErr) throw insertErr;

      router.push('/landlord/expenses');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="receipt">Receipt photo (optional)</Label>
        <Input
          id="receipt"
          type="file"
          accept="image/*"
          onChange={(e) => {
            setReceipt(e.target.files?.[0] ?? null);
            setScanMessage(null);
          }}
        />
        <p className="text-xs text-muted-foreground">
          Choose a photo from your library, or take a new one. Tap{' '}
          <strong>Scan receipt</strong> below to auto-fill amount, vendor, and category.
        </p>
        {receipt ? (
          <Button
            type="button"
            variant="outline"
            onClick={handleScan}
            disabled={scanning}
            className="w-full"
          >
            <Sparkles size={14} />
            {scanning ? 'Reading receipt…' : 'Scan receipt'}
          </Button>
        ) : null}
        {scanMessage ? (
          <p className="rounded-lg border border-success/30 bg-success/5 p-2 text-xs text-success">
            {scanMessage}
          </p>
        ) : null}
      </div>

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
          <Label htmlFor="date">Date</Label>
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
        <Label htmlFor="category">Category</Label>
        <Select
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value as (typeof EXPENSE_CATEGORIES)[number])}
        >
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="vendor">Vendor (optional)</Label>
        <Input id="vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} />
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

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? 'Saving…' : 'Save expense'}
      </Button>
    </form>
  );
}
