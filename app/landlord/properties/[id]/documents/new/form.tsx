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
  'Tax document',
  'Receipt',
  'Other',
] as const;

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
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError('Pick a file to upload.');
      return;
    }
    setBusy(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const path = `${propertyId}/${Date.now()}-${safeName}`;

      const { error: upErr } = await supabase.storage
        .from('documents')
        .upload(path, file, {
          upsert: false,
          contentType: file.type || 'application/octet-stream',
        });
      if (upErr) throw upErr;

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
            {file.name} · {(file.size / 1024).toFixed(0)} KB
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="type">Type</Label>
        <Select id="type" value={type} onChange={(e) => setType(e.target.value as (typeof DOC_TYPES)[number])}>
          {DOC_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
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
          <label
            className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${
              isLease ? 'opacity-70' : ''
            }`}
          >
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

      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? 'Uploading…' : 'Upload document'}
      </Button>
      <BusyBar active={busy} />
    </form>
  );
}
