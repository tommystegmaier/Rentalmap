'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { resizeForUpload } from '@/lib/image';
import { setWorkOrderReceipt, removeWorkOrderReceipt } from '@/app/landlord/maintenance/[id]/actions';
import { X } from 'lucide-react';

interface Props {
  workOrderId: string;
  propertyId: string;
  receiptSignedUrl: string | null;
  hasReceipt: boolean;
}

export function WorkOrderReceipt({
  workOrderId,
  propertyId,
  receiptSignedUrl,
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
      let blob: Blob = file;
      try {
        blob = await resizeForUpload(file);
      } catch {
        // Fall back to the original if resize fails.
      }
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${propertyId}/wo-${workOrderId}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('receipts')
        .upload(path, blob, { upsert: false });
      if (upErr) throw upErr;

      await setWorkOrderReceipt(workOrderId, path);
      toast.success('Receipt attached');
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={receiptSignedUrl}
            alt="Work order receipt"
            className="aspect-video w-full rounded-lg border bg-white object-contain"
            loading="lazy"
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
          Attach a receipt for this repair. When the work order is completed, it&apos;s logged
          as an expense automatically.
        </p>
      )}

      <div className="space-y-1">
        <Label htmlFor="wo-receipt" className="text-sm font-medium">
          {hasReceipt ? 'Replace receipt' : 'Upload receipt'}
        </Label>
        <Input
          id="wo-receipt"
          type="file"
          accept="image/*"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
          }}
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
