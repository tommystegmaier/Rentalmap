'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Sparkles, Landmark } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { EXPENSE_CATEGORIES } from '@/lib/constants';
import { parseDollarsToCents } from '@/lib/utils';
import { isIsoDate } from '@/lib/image';
import { prepareScanUpload } from '@/lib/scan-upload';
import { receiptToPdf } from '@/lib/receipt-pdf';
import { BusyBar } from '@/components/busy-bar';

interface ExpenseFormProps {
  properties: { id: string; address: string }[];
  initialPropertyId?: string;
  /** If set, redirect here after save instead of the expenses list */
  returnPropertyId?: string;
}

export function ExpenseForm({ properties, initialPropertyId, returnPropertyId }: ExpenseFormProps) {
  const router = useRouter();
  const [propertyId, setPropertyId] = useState(
    initialPropertyId ?? properties[0]?.id ?? '',
  );
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<(typeof EXPENSE_CATEGORIES)[number]>('Repairs');
  const [vendor, setVendor] = useState('');
  const [notes, setNotes] = useState('');
  const [taxDeductible, setTaxDeductible] = useState(true);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [isMortgage, setIsMortgage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mortgageHref = `/landlord/expenses/mortgage/new${
    propertyId ? `?property_id=${propertyId}` : ''
  }`;

  async function handleScan() {
    if (!receipt) {
      setError('Pick a receipt photo first.');
      return;
    }
    setScanning(true);
    setError(null);
    setScanMessage(null);
    setIsMortgage(false);
    try {
      // Downsize images before sending; PDFs pass through untouched.
      const { blob, filename } = await prepareScanUpload(receipt);
      const fd = new FormData();
      fd.append('file', blob, filename);
      const res = await fetch('/api/expenses/scan', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Scan failed');

      if (typeof json.amount === 'number' && Number.isFinite(json.amount)) {
        setAmount(json.amount.toFixed(2));
      }
      if (typeof json.vendor === 'string' && json.vendor.trim()) {
        setVendor(json.vendor.trim());
      }
      if (isIsoDate(json.date)) {
        setDate(json.date);
      }
      if (
        typeof json.category === 'string' &&
        (EXPENSE_CATEGORIES as readonly string[]).includes(json.category)
      ) {
        setCategory(json.category);
      }
      if (typeof json.description === 'string' && json.description.trim()) {
        setNotes((prev) =>
          prev ? `${prev}\n${json.description.trim()}` : json.description.trim(),
        );
      }
      setIsMortgage(json.isMortgageStatement === true);
      setScanMessage(
        'Fields filled in from the photo. Review and tweak anything that looks off before saving.',
      );
    } catch (err) {
      setError(friendlyScanError(err));
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
        // Archive the receipt as a PDF for cleaner tax documentation.
        const { blob, ext, contentType } = await receiptToPdf(receipt);
        const path = `${propertyId}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('receipts')
          .upload(path, blob, { upsert: false, contentType });
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
        tax_deductible: taxDeductible,
        created_by: user.id,
      });
      if (insertErr) throw insertErr;

      if (returnPropertyId) {
        router.push(`/landlord/properties/${returnPropertyId}`);
      } else {
        router.push('/landlord/expenses');
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Link
        href={mortgageHref}
        className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground transition hover:bg-muted/40"
      >
        <Landmark size={14} className="shrink-0" />
        <span>
          Paying a mortgage? <span className="font-medium text-foreground">Log it as a mortgage payment</span>{' '}
          to split interest, principal, taxes &amp; insurance.
        </span>
      </Link>

      <div className="space-y-2">
        <Label htmlFor="receipt">Receipt — photo or PDF (optional)</Label>
        <Input
          id="receipt"
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => {
            setReceipt(e.target.files?.[0] ?? null);
            setScanMessage(null);
            setIsMortgage(false);
            setError(null);
          }}
        />
        <p className="text-xs text-muted-foreground">
          Choose a photo from your library, or take a new one. Tap{' '}
          <strong>Scan receipt</strong> below to auto-fill amount, vendor, and category.
        </p>
        {receipt ? (
          <>
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
            <BusyBar active={scanning} />
          </>
        ) : null}
        {isMortgage ? (
          <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200">
            <p className="font-medium">This looks like a mortgage statement.</p>
            <p>
              The amount above is your <strong>total payment</strong> — recording it as one
              expense would overstate your interest deduction. Use the mortgage tool to split it
              into interest, principal, taxes &amp; insurance.
            </p>
            <Link
              href={mortgageHref}
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 font-medium text-white hover:bg-amber-700"
            >
              <Landmark size={13} />
              Log as a mortgage payment
            </Link>
          </div>
        ) : scanMessage ? (
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

      <label className="flex items-center gap-3 rounded-lg border p-3 tap-44">
        <input
          type="checkbox"
          checked={taxDeductible}
          onChange={(e) => setTaxDeductible(e.target.checked)}
          className="h-4 w-4"
        />
        <span className="flex-1 text-sm">
          <span className="font-medium">Tax deductible</span>
          <span className="block text-xs text-muted-foreground">
            Counts toward your deductible total for tax reports. Uncheck for non-deductible
            costs (e.g. mortgage principal).
          </span>
        </span>
      </label>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? 'Saving…' : 'Save expense'}
      </Button>
      <BusyBar active={busy} />
    </form>
  );
}

function friendlyScanError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (/exceeds 5 ?MB/i.test(raw) || /too large/i.test(raw)) {
    return 'That photo is too large even after compression. Try cropping or retaking it at a lower zoom.';
  }
  if (/ANTHROPIC_API_KEY/i.test(raw) || /not set up/i.test(raw) || /not configured/i.test(raw)) {
    return "Receipt scanning isn't configured yet. Add ANTHROPIC_API_KEY in Vercel, redeploy, and try again.";
  }
  if (/string did not match/i.test(raw)) {
    return "We couldn't read part of the receipt. Tap Save expense and fill the fields in by hand.";
  }
  return raw || 'Scan failed';
}
