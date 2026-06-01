'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { BusyBar } from '@/components/busy-bar';

const DOC_TYPES = [
  'Lease',
  'Lease addendum',
  'Move-in inspection',
  'Move-out inspection',
  'Insurance policy',
  'Mortgage statement',
  'Tax document',
  'Receipt',
  'Other',
] as const;

async function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX_DIM = 2048;
      let { width, height } = img;
      if (width > MAX_DIM || height > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) { resolve(file); return; }
          resolve(new File([blob], file.name, { type: 'image/jpeg' }));
        },
        'image/jpeg',
        0.85,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

interface UploadFormProps {
  propertyId: string;
  leases: { id: string; start_date: string; end_date: string; status: string }[];
}

export function UploadForm({ propertyId, leases }: UploadFormProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<(typeof DOC_TYPES)[number]>('Lease');
  const [leaseId, setLeaseId] = useState<string>(
    leases.find((l) => l.status === 'active')?.id ?? '',
  );
  const [visibleToTenant, setVisibleToTenant] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) { setError('Pick a file to upload.'); return; }

    setBusy(true);
    setProgress(0);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const uploadFile = file.type.startsWith('image/') ? await compressImage(file) : file;
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const path = `${propertyId}/${Date.now()}-${safeName}`;
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

      // Use XHR instead of the SDK so we get real upload progress events.
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            try {
              const body = JSON.parse(xhr.responseText);
              reject(new Error(body.error ?? body.message ?? `Upload failed (${xhr.status})`));
            } catch {
              reject(new Error(`Upload failed (${xhr.status})`));
            }
          }
        };

        xhr.onerror = () => reject(new Error('Upload failed — check your connection and try again.'));
        xhr.ontimeout = () => reject(new Error('Upload timed out. Check your connection or try a smaller file.'));
        xhr.timeout = 180_000; // 3 minutes

        xhr.open('POST', `${supabaseUrl}/storage/v1/object/documents/${path}`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.setRequestHeader('x-upsert', 'false');
        if (uploadFile.type) xhr.setRequestHeader('Content-Type', uploadFile.type);
        xhr.send(uploadFile);
      });

      const isLease = type === 'Lease' || type === 'Lease addendum';
      const { error: insertErr } = await supabase.from('documents').insert({
        property_id: propertyId,
        lease_id: leaseId || null,
        type,
        filename: file.name,
        file_url: path,
        visible_to_tenant: isLease ? true : visibleToTenant,
        uploaded_by: user.id,
      });
      if (insertErr) throw insertErr;

      router.push(`/landlord/properties/${propertyId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="file">File (PDF or image)</Label>
        <Input
          id="file"
          type="file"
          accept="application/pdf,image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          required
        />
        {file ? (
          <p className="text-xs text-muted-foreground">
            {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB
            {file.type.startsWith('image/') ? ' (will be compressed before upload)' : ''}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="type">Type</Label>
        <Select id="type" value={type} onChange={(e) => setType(e.target.value as (typeof DOC_TYPES)[number])}>
          {DOC_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </Select>
      </div>

      {leases.length > 0 ? (
        <div className="space-y-2">
          <Label htmlFor="lease">Lease (optional)</Label>
          <Select id="lease" value={leaseId} onChange={(e) => setLeaseId(e.target.value)}>
            <option value="">Not lease-specific</option>
            {leases.map((l) => (
              <option key={l.id} value={l.id}>
                {l.start_date} → {l.end_date} ({l.status})
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      {(() => {
        const isLease = type === 'Lease' || type === 'Lease addendum';
        const effectiveVisible = isLease ? true : visibleToTenant;
        return (
          <label className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${isLease ? 'opacity-70' : ''}`}>
            <input
              type="checkbox"
              checked={effectiveVisible}
              onChange={(e) => setVisibleToTenant(e.target.checked)}
              disabled={isLease}
              className="mt-0.5 h-4 w-4"
            />
            <div>
              <p className="font-medium">Share with tenant</p>
              <p className="text-muted-foreground">
                {isLease
                  ? 'Lease documents are always shared with tenants on this property — including any tenants added later.'
                  : 'When on, the tenant can see and download this file from their home screen. Off keeps it landlord-only (e.g. private inspection notes).'}
              </p>
            </div>
          </label>
        );
      })()}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {progress !== null && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Uploading…</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? 'Uploading…' : 'Upload document'}
      </Button>
      <BusyBar active={busy && progress === null} />
    </form>
  );
}
