'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  URGENCY_LABELS,
  WORK_ORDER_REQUEST_TYPES,
  type WorkOrderRequestType,
} from '@/lib/constants';
import { parseDollarsToCents } from '@/lib/utils';
import { StagedPhotoGrid } from '@/components/staged-photo-grid';
import { BusyBar } from '@/components/busy-bar';

interface Props {
  properties: { id: string; address: string; active_lease_id: string | null }[];
}

const urgencies = ['emergency', 'urgent', 'normal', 'low'] as const;

export function LandlordWorkOrderForm({ properties }: Props) {
  const router = useRouter();
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? '');
  const [requestType, setRequestType] = useState<WorkOrderRequestType>(
    WORK_ORDER_REQUEST_TYPES[0],
  );
  const [urgency, setUrgency] = useState<(typeof urgencies)[number]>('normal');
  const [status, setStatus] = useState<'open' | 'in_progress' | 'closed'>('in_progress');
  const [description, setDescription] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [vendorPhone, setVendorPhone] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedProperty = properties.find((p) => p.id === propertyId);

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(e.target.files ?? []);
    setPhotos((prev) => [...prev, ...incoming].slice(0, 5));
    // Reset so picking the same file again still fires onChange.
    e.target.value = '';
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const totalCostCents = totalCost ? parseDollarsToCents(totalCost) : null;

      const { data: inserted, error: insertErr } = await supabase
        .from('work_orders')
        .insert({
          property_id: propertyId,
          lease_id: selectedProperty?.active_lease_id ?? null,
          submitted_by_user_id: user.id,
          request_type: requestType,
          description,
          urgency,
          status,
          vendor_name: vendorName || null,
          vendor_phone: vendorPhone || null,
          total_cost_cents: totalCostCents,
          photo_urls: [],
          closed_at: status === 'closed' ? new Date().toISOString() : null,
        })
        .select('id')
        .single();

      if (insertErr || !inserted) throw insertErr ?? new Error('Failed to create');

      const photoPaths: string[] = [];
      for (const photo of photos) {
        const ext = photo.name.split('.').pop() ?? 'jpg';
        const path = `${inserted.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('work-order-photos')
          .upload(path, photo, { upsert: false });
        if (upErr) throw upErr;
        photoPaths.push(path);
      }
      if (photoPaths.length > 0) {
        await supabase
          .from('work_orders')
          .update({ photo_urls: photoPaths })
          .eq('id', inserted.id);
      }

      router.push(`/landlord/maintenance/${inserted.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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

      <div className="space-y-2">
        <Label htmlFor="type">Request type</Label>
        <Select
          id="type"
          value={requestType}
          onChange={(e) => setRequestType(e.target.value as WorkOrderRequestType)}
        >
          {WORK_ORDER_REQUEST_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Urgency</Label>
        <div className="space-y-1">
          {urgencies.map((u) => (
            <label
              key={u}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 tap-44 ${
                urgency === u ? 'border-primary bg-primary/5' : ''
              }`}
            >
              <input
                type="radio"
                name="urgency"
                value={u}
                checked={urgency === u}
                onChange={() => setUrgency(u)}
                className="mt-0.5"
              />
              <div className="flex-1">
                <p className="font-medium">{URGENCY_LABELS[u].label}</p>
                <p className="text-xs text-muted-foreground">{URGENCY_LABELS[u].help}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <Select
          id="status"
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
        >
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="closed">Closed</option>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          rows={4}
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What needs to be done?"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="vendor_name">Vendor name</Label>
          <Input
            id="vendor_name"
            value={vendorName}
            onChange={(e) => setVendorName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vendor_phone">Vendor phone</Label>
          <Input
            id="vendor_phone"
            type="tel"
            value={vendorPhone}
            onChange={(e) => setVendorPhone(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="total_cost">Total cost ($)</Label>
        <Input
          id="total_cost"
          inputMode="decimal"
          value={totalCost}
          onChange={(e) => setTotalCost(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="photos">Photos (up to 5)</Label>
        <Input
          id="photos"
          type="file"
          accept="image/*"
          multiple
          onChange={handleFiles}
        />
        {photos.length > 0 ? (
          <>
            <p className="text-xs text-muted-foreground">
              {photos.length} photo{photos.length === 1 ? '' : 's'} selected · tap ✕ to remove
            </p>
            <StagedPhotoGrid photos={photos} onRemove={removePhoto} />
          </>
        ) : null}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? 'Saving…' : 'Create work order'}
      </Button>
      <BusyBar active={busy} />
    </form>
  );
}
