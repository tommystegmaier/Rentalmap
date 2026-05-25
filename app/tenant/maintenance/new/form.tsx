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

interface WorkOrderFormProps {
  leaseId: string;
  propertyId: string;
}

const urgencies = ['emergency', 'urgent', 'normal', 'low'] as const;

export function WorkOrderForm({ leaseId, propertyId }: WorkOrderFormProps) {
  const router = useRouter();
  const [requestType, setRequestType] = useState<WorkOrderRequestType>('Plumbing');
  const [urgency, setUrgency] = useState<(typeof urgencies)[number]>('normal');
  const [description, setDescription] = useState('');
  const [contactPref, setContactPref] = useState<'phone' | 'text' | 'email'>('text');
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 5);
    setPhotos(files);
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

      // Insert the work order first so we have an id for the photo path.
      const { data: inserted, error: insertErr } = await supabase
        .from('work_orders')
        .insert({
          property_id: propertyId,
          lease_id: leaseId,
          submitted_by_user_id: user.id,
          request_type: requestType,
          description,
          urgency,
          tenant_contact_preference: contactPref,
          photo_urls: [],
        })
        .select('id')
        .single();

      if (insertErr || !inserted) throw insertErr ?? new Error('Failed to create work order');

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
        const { error: updErr } = await supabase
          .from('work_orders')
          .update({ photo_urls: photoPaths })
          .eq('id', inserted.id);
        if (updErr) throw updErr;
      }

      // Fire-and-forget landlord notification; never blocks the redirect.
      fetch('/api/work-orders/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ work_order_id: inserted.id }),
      }).catch(() => {});

      router.push(`/tenant/maintenance/${inserted.id}`);
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
        <Label htmlFor="request-type">Request type</Label>
        <Select
          id="request-type"
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
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          rows={4}
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What's wrong and where?"
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
          <p className="text-xs text-muted-foreground">
            {photos.length} photo{photos.length === 1 ? '' : 's'} selected
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact">Contact preference</Label>
        <Select
          id="contact"
          value={contactPref}
          onChange={(e) =>
            setContactPref(e.target.value as 'phone' | 'text' | 'email')
          }
        >
          <option value="text">Text</option>
          <option value="phone">Phone</option>
          <option value="email">Email</option>
        </Select>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? 'Submitting…' : 'Submit work order'}
      </Button>
    </form>
  );
}
