'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { resizeForUpload } from '@/lib/image';
import { addRepairPhotos, removeRepairPhoto } from '@/app/landlord/maintenance/[id]/actions';
import { X } from 'lucide-react';

interface Photo {
  path: string;
  signedUrl: string;
}

export function WorkOrderRepairPhotos({
  workOrderId,
  photos,
}: {
  workOrderId: string;
  photos: Photo[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(files: FileList) {
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const paths: string[] = [];
      for (const file of Array.from(files).slice(0, 10)) {
        let blob: Blob = file;
        try {
          blob = await resizeForUpload(file);
        } catch {
          // fall back to original
        }
        const ext = file.name.split('.').pop() ?? 'jpg';
        const path = `${workOrderId}/repair-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('work-order-photos')
          .upload(path, blob, { upsert: false });
        if (upErr) throw upErr;
        paths.push(path);
      }
      if (paths.length > 0) {
        await addRepairPhotos(workOrderId, paths);
        toast.success(paths.length === 1 ? 'Photo added' : `${paths.length} photos added`);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(path: string) {
    setBusy(true);
    setError(null);
    try {
      await removeRepairPhoto(workOrderId, path);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {photos.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {photos.map((p) => (
            <div key={p.path} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.signedUrl}
                alt="Repair photo"
                className="aspect-square w-full rounded-lg border object-cover"
                loading="lazy"
              />
              <button
                type="button"
                onClick={() => handleRemove(p.path)}
                disabled={busy}
                aria-label="Remove photo"
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Add photos of the completed repair (optional). Visible to the tenant.
        </p>
      )}

      <div className="space-y-1">
        <Label htmlFor="repair-photos" className="text-sm font-medium">
          {photos.length > 0 ? 'Add more photos' : 'Upload repair photos'}
        </Label>
        <Input
          id="repair-photos"
          type="file"
          accept="image/*"
          multiple
          disabled={busy}
          onChange={(e) => {
            if (e.target.files?.length) handleUpload(e.target.files);
          }}
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
