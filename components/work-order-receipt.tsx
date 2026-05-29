'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { receiptToPdf } from '@/lib/receipt-pdf';
import { prepareScanUpload } from '@/lib/scan-upload';
import { formatCents } from '@/lib/utils';
import { ReceiptViewer } from '@/components/receipt-viewer';
import { setWorkOrderReceipt, removeWorkOrderReceipt } from '@/app/landlord/maintenance/[id]/actions';
import { X } from 'lucide-react';

interface Props {
  workOrderId: string;
  propertyId: string;
  receiptSignedUrl: string | null;
  receiptPath: string | null;
  hasReceipt: boolean;
}

export function WorkOrderReceipt({
  workOrderId,
  propertyId,
  receiptSignedUrl,
  receiptPath,
  hasReceipt,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();

      // Best-effort AI scan to auto-fill total cost & vendor (empty fields only).
      let scanned: { totalCostCents: number | null; vendorName: string | null } | undefined;
      try {
        const { blob: scanBlob, filename } = await prepareScanUpload(file);
        const fd = new FormData();
        fd.append('file', scanBlob, filename);
        const res = await fetch('/api/expenses/scan', { method: 'POST', body: fd });
        if (res.ok) {
          const json = await res.json();
          scanned = {
            totalCostCents:
              typeof json.amount === 'number' && Number.isFinite(json.amount)
                ? Math.round(json.amount * 100)
                : null,
            vendorName:
              typeof json.vendor === 'string' && json.vendor.trim() ? json.vendor.trim() : null,
          };
        }
      } catch {
        // Scanning is optional — proceed with the upload regardless.
      }

      // Archive the receipt as a PDF for cleaner tax documentation.
      const { blob, ext, contentType } = await receiptToPdf(file);
      const path = `${propertyId}/wo-${workOrderId}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('receipts')
        .upload(path, blob, { upsert: false, contentType });
      if (upErr) throw upErr;

      await setWorkOrderReceipt(workOrderId, path, scanned);

      const filled: string[] = [];
      if (scanned?.totalCostCents != null) filled.push(formatCents(scanned.totalCostCents));
      if (scanned?.vendorName) filled.push(scanned.vendorName);
      toast.success(
        filled.length ? `Receipt attached · filled ${filled.join(' · ')}` : 'Receipt attached',
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    if (!confirm('Remove this receipt?')) return;
    setBusy(true);
    setError(null);
    try {
      await removeWorkOrderReceipt(workOrderId);
      toast.success('Receipt removed');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {hasReceipt && receiptSignedUrl ? (
        <div className="space-y-2">
          <ReceiptViewer
            signedUrl={receiptSignedUrl}
            path={receiptPath}
            alt="Work order receipt"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRemove}
            disabled={busy}
          >
            <X size={14} /> Remove receipt
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Attach a receipt for this repair. We&apos;ll read it to auto-fill the total cost and
          vendor, and once the work order is completed it&apos;s logged as an expense automatically.
        </p>
      )}

      <div className="space-y-1">
        <Label htmlFor="wo-receipt" className="text-sm font-medium">
          {hasReceipt ? 'Replace receipt' : 'Upload receipt'}
        </Label>
        <Input
          id="wo-receipt"
          type="file"
          accept="image/*,application/pdf"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
          }}
        />
      </div>

      {busy ? (
        <p className="text-xs text-muted-foreground">Reading receipt &amp; uploading…</p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
