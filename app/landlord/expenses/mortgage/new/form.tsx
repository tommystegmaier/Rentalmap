'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { parseDollarsToCents } from '@/lib/utils';
import { prepareScanUpload } from '@/lib/scan-upload';
import { receiptToPdf } from '@/lib/receipt-pdf';
import { createMortgageExpenses } from './actions';

interface Props {
  properties: { id: string; address: string }[];
  initialPropertyId?: string;
}

export function MortgageForm({ properties, initialPropertyId }: Props) {
  const router = useRouter();
  const [propertyId, setPropertyId] = useState(
    initialPropertyId ?? properties[0]?.id ?? '',
  );
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [lender, setLender] = useState('');
  const [interest, setInterest] = useState('');
  const [principal, setPrincipal] = useState('');
  const [taxes, setTaxes] = useState('');
  const [insurance, setInsurance] = useState('');
  const [statement, setStatement] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleScan() {
    if (!statement) {
      setError('Pick a statement photo first.');
      return;
    }
    setScanning(true);
    setError(null);
    setScanMessage(null);
    try {
      const { blob, filename } = await prepareScanUpload(statement);
      const fd = new FormData();
      fd.append('file', blob, filename);
      const res = await fetch('/api/expenses/scan-mortgage', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Scan failed');

      if (typeof json.lender === 'string' && json.lender.trim()) setLender(json.lender.trim());
      if (typeof json.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(json.date)) setDate(json.date);
      const set = (v: unknown, setter: (s: string) => void) => {
        if (typeof v === 'number' && Number.isFinite(v) && v > 0) setter(v.toFixed(2));
      };
      set(json.interest, setInterest);
      set(json.principal, setPrincipal);
      set(json.escrowTaxes, setTaxes);
      set(json.escrowInsurance, setInsurance);
      setScanMessage('Filled in from the statement. Review the split before saving.');
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
    try {
      const interestCents = (interest ? parseDollarsToCents(interest) : 0) ?? 0;
      const principalCents = (principal ? parseDollarsToCents(principal) : 0) ?? 0;
      const taxesCents = (taxes ? parseDollarsToCents(taxes) : 0) ?? 0;
      const insuranceCents = (insurance ? parseDollarsToCents(insurance) : 0) ?? 0;

      if (interestCents + principalCents + taxesCents + insuranceCents <= 0) {
        setError('Enter at least one amount.');
        setBusy(false);
        return;
      }

      // Archive the statement as a PDF and attach it to every line.
      let receiptPath: string | null = null;
      if (statement) {
        const supabase = createClient();
        const { blob, ext, contentType } = await receiptToPdf(statement);
        const path = `${propertyId}/mortgage-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('receipts')
          .upload(path, blob, { upsert: false, contentType });
        if (upErr) throw upErr;
        receiptPath = path;
      }

      await createMortgageExpenses({
        propertyId,
        date,
        lender,
        interestCents,
        principalCents,
        taxesCents,
        insuranceCents,
        receiptPath,
      });

      toast.success('Mortgage payment recorded');
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
        <Label htmlFor="statement">Mortgage statement (optional)</Label>
        <Input
          id="statement"
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => {
            setStatement(e.target.files?.[0] ?? null);
            setScanMessage(null);
            setError(null);
          }}
        />
        <p className="text-xs text-muted-foreground">
          Upload your statement and tap <strong>Scan statement</strong> to auto-fill the
          interest / principal / escrow split. The statement is saved as a PDF on each line.
        </p>
        {statement ? (
          <Button
            type="button"
            variant="outline"
            onClick={handleScan}
            disabled={scanning}
            className="w-full"
          >
            <Sparkles size={14} />
            {scanning ? 'Reading statement…' : 'Scan statement'}
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
          <Label htmlFor="lender">Lender</Label>
          <Input id="lender" value={lender} onChange={(e) => setLender(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="date">Statement date</Label>
          <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
      </div>

      <div className="rounded-lg border bg-card p-3 space-y-3">
        <p className="text-sm font-medium">Payment breakdown</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="interest" className="text-xs">Interest · deductible</Label>
            <Input id="interest" inputMode="decimal" value={interest} onChange={(e) => setInterest(e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="principal" className="text-xs">Principal · not deductible</Label>
            <Input id="principal" inputMode="decimal" value={principal} onChange={(e) => setPrincipal(e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="taxes" className="text-xs">Property taxes (escrow) · deductible</Label>
            <Input id="taxes" inputMode="decimal" value={taxes} onChange={(e) => setTaxes(e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="insurance" className="text-xs">Insurance (escrow) · deductible</Label>
            <Input id="insurance" inputMode="decimal" value={insurance} onChange={(e) => setInsurance(e.target.value)} placeholder="0.00" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Each non-zero amount becomes its own expense line. Principal is logged but excluded
          from your deductible total.
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? 'Saving…' : 'Record mortgage payment'}
      </Button>
    </form>
  );
}
