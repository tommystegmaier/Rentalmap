'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Sparkles, Trash2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { EXPENSE_CATEGORIES, type ExpenseCategory } from '@/lib/constants';
import { parseDollarsToCents } from '@/lib/utils';
import { isIsoDate } from '@/lib/image';
import { prepareScanUpload } from '@/lib/scan-upload';
import { receiptToPdf } from '@/lib/receipt-pdf';
import { ReceiptViewer } from '@/components/receipt-viewer';
import { deleteExpense, updateExpense } from './actions';

interface EditExpenseFormProps {
  expense: {
    id: string;
    property_id: string;
    date: string;
    amount_cents: number;
    category: string;
    vendor: string | null;
    notes: string | null;
    receipt_url: string | null;
    tax_deductible: boolean;
  };
  receiptSignedUrl: string | null;
  properties: { id: string; address: string }[];
}

export function EditExpenseForm({
  expense,
  receiptSignedUrl,
  properties,
}: EditExpenseFormProps) {
  const router = useRouter();
  const [propertyId, setPropertyId] = useState(expense.property_id);
  const [date, setDate] = useState(expense.date);
  const [amount, setAmount] = useState((expense.amount_cents / 100).toFixed(2));
  const initialCategory: ExpenseCategory = (EXPENSE_CATEGORIES as readonly string[]).includes(
    expense.category,
  )
    ? (expense.category as ExpenseCategory)
    : 'Other';
  const [category, setCategory] = useState<ExpenseCategory>(initialCategory);
  const [vendor, setVendor] = useState(expense.vendor ?? '');
  const [notes, setNotes] = useState(expense.notes ?? '');
  const [taxDeductible, setTaxDeductible] = useState(expense.tax_deductible);
  const [newReceipt, setNewReceipt] = useState<File | null>(null);
  const [removeExistingReceipt, setRemoveExistingReceipt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasExistingReceipt = !!expense.receipt_url && !removeExistingReceipt;

  async function handleScan() {
    if (!newReceipt) return;
    setScanning(true);
    setError(null);
    setScanMessage(null);
    try {
      const { blob, filename } = await prepareScanUpload(newReceipt);
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
        setCategory(json.category as ExpenseCategory);
      }
      if (typeof json.description === 'string' && json.description.trim()) {
        setNotes((prev) =>
          prev ? `${prev}\n${json.description.trim()}` : json.description.trim(),
        );
      }
      setScanMessage('Fields updated from the new photo. Review and tweak before saving.');
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
      let receipt_url = expense.receipt_url;

      // If they uploaded a new file, swap it in and delete the old.
      if (newReceipt) {
        const { blob, ext, contentType } = await receiptToPdf(newReceipt);
        const path = `${propertyId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('receipts')
          .upload(path, blob, { upsert: false, contentType });
        if (upErr) throw upErr;
        if (expense.receipt_url) {
          await supabase.storage.from('receipts').remove([expense.receipt_url]);
        }
        receipt_url = path;
      } else if (removeExistingReceipt) {
        if (expense.receipt_url) {
          await supabase.storage.from('receipts').remove([expense.receipt_url]);
        }
        receipt_url = null;
      }

      await updateExpense({
        id: expense.id,
        property_id: propertyId,
        date,
        amount_cents: cents,
        category,
        vendor: vendor || null,
        notes: notes || null,
        receipt_url,
        tax_deductible: taxDeductible,
      });

      toast.success('Expense saved');
      router.push('/landlord/expenses');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this expense? This cannot be undone.')) return;
    setBusy(true);
    setError(null);
    try {
      await deleteExpense(expense.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Receipt</Label>
        {hasExistingReceipt && receiptSignedUrl ? (
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <ReceiptViewer
              signedUrl={receiptSignedUrl}
              path={expense.receipt_url}
              alt="Current receipt"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRemoveExistingReceipt(true)}
            >
              <X size={14} /> Remove receipt
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {removeExistingReceipt
              ? 'Existing receipt will be removed on save.'
              : 'No receipt on file.'}
          </p>
        )}

        <Label htmlFor="receipt">
          {hasExistingReceipt ? 'Replace receipt photo' : 'Add receipt photo'}
        </Label>
        <Input
          id="receipt"
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => {
            setNewReceipt(e.target.files?.[0] ?? null);
            setScanMessage(null);
            setError(null);
          }}
        />
        {newReceipt ? (
          <Button
            type="button"
            variant="outline"
            onClick={handleScan}
            disabled={scanning}
            className="w-full"
          >
            <Sparkles size={14} />
            {scanning ? 'Reading receipt…' : 'Re-scan with the new photo'}
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
        <Select id="property" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
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
          onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
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
        <Textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
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
            Counts toward your deductible total for tax reports.
          </span>
        </span>
      </label>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? 'Saving…' : 'Save changes'}
      </Button>

      <Button
        type="button"
        variant="outline"
        onClick={handleDelete}
        disabled={busy}
        className="w-full text-destructive hover:bg-destructive/10"
      >
        <Trash2 size={14} /> Delete expense
      </Button>
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
    return "We couldn't read part of the receipt. Fill the fields in by hand instead.";
  }
  return raw || 'Scan failed';
}
