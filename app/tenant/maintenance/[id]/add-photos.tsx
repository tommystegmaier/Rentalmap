'use client';

import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { appendWorkOrderPhotos } from './actions';

export function AddWorkOrderPhotos({ workOrderId }: { workOrderId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const paths: string[] = [];
      for (const file of files) {
        const ext = file.name.split('.').pop() ?? 'jpg';
        const path = `${workOrderId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('work-order-photos')
          .upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        paths.push(path);
      }
      await appendWorkOrderPhotos(workOrderId, paths);
      toast.success(`${files.length} photo${files.length === 1 ? '' : 's'} added`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFiles}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="gap-2"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
        {busy ? 'Uploading…' : 'Add photos'}
      </Button>
    </div>
  );
}
