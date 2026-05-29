'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { parseDollarsToCents } from '@/lib/utils';
import { deleteProperty } from '../actions';
import { BusyBar } from '@/components/busy-bar';

interface Property {
  id: string;
  address: string;
  type: string;
  purchase_price_cents: number | null;
  placed_in_service: string | null;
  depreciable_basis_cents: number | null;
  annual_depreciation_cents: number | null;
  asking_rent_cents: number | null;
  photo_url: string | null;
  notes: string | null;
}

const centsToInput = (c: number | null) => (c == null ? '' : (c / 100).toFixed(0));

export function EditPropertyForm({ property }: { property: Property }) {
  const router = useRouter();
  const [address, setAddress] = useState(property.address);
  const [type, setType] = useState(property.type);
  const [purchasePrice, setPurchasePrice] = useState(centsToInput(property.purchase_price_cents));
  const [placedInService, setPlacedInService] = useState(property.placed_in_service ?? '');
  const [depreciableBasis, setDepreciableBasis] = useState(centsToInput(property.depreciable_basis_cents));
  const [annualDepreciation, setAnnualDepreciation] = useState(centsToInput(property.annual_depreciation_cents));
  const [askingRent, setAskingRent] = useState(centsToInput(property.asking_rent_cents));
  const [notes, setNotes] = useState(property.notes ?? '');
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();
  const currentPhotoUrl = property.photo_url
    ? supabase.storage.from('property-photos').getPublicUrl(property.photo_url).data.publicUrl
    : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      let newPhotoPath: string | null = null;
      if (photo) {
        const ext = photo.name.split('.').pop() ?? 'jpg';
        newPhotoPath = `${property.id}/cover-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('property-photos')
          .upload(newPhotoPath, photo, {
            upsert: false,
            contentType: photo.type || 'image/jpeg',
          });
        if (upErr) throw upErr;
      }

      const updates: Record<string, unknown> = {
        address: address.trim(),
        type,
        purchase_price_cents: parseDollarsToCents(purchasePrice),
        placed_in_service: placedInService || null,
        depreciable_basis_cents: parseDollarsToCents(depreciableBasis),
        annual_depreciation_cents: parseDollarsToCents(annualDepreciation),
        asking_rent_cents: parseDollarsToCents(askingRent),
        notes: notes.trim() || null,
      };
      if (newPhotoPath) updates.photo_url = newPhotoPath;

      const { error: updErr } = await supabase
        .from('properties')
        .update(updates)
        .eq('id', property.id);
      if (updErr) throw updErr;

      // Clean up old photo file if we uploaded a new one
      if (newPhotoPath && property.photo_url) {
        await supabase.storage.from('property-photos').remove([property.photo_url]);
      }

      router.push(`/landlord/properties/${property.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto() {
    if (!property.photo_url) return;
    if (!confirm('Remove the property photo?')) return;
    setBusy(true);
    try {
      await supabase.storage.from('property-photos').remove([property.photo_url]);
      await supabase.from('properties').update({ photo_url: null }).eq('id', property.id);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Property photo</Label>
        {currentPhotoUrl ? (
          <div className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentPhotoUrl}
              alt="Property"
              className="aspect-video w-full rounded-xl border object-cover"
            />
            <Button type="button" variant="outline" size="sm" onClick={removePhoto} disabled={busy}>
              Remove photo
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No photo yet.</p>
        )}
        <Input
          type="file"
          accept="image/*"
          onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
        />
        {photo ? (
          <p className="text-xs text-muted-foreground">
            Will replace current photo on save.
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Address *</Label>
        <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="type">Type</Label>
        <Select id="type" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="single_family">Single-family</option>
          <option value="multi_family">Multi-family</option>
          <option value="condo">Condo</option>
          <option value="townhouse">Townhouse</option>
          <option value="other">Other</option>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="asking_rent">Asking / current rent ($/mo)</Label>
        <Input
          id="asking_rent"
          inputMode="decimal"
          value={askingRent}
          onChange={(e) => setAskingRent(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Used as the default when you create a new lease for this property.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="purchase_price">Purchase price ($)</Label>
        <Input
          id="purchase_price"
          inputMode="decimal"
          value={purchasePrice}
          onChange={(e) => setPurchasePrice(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="placed_in_service">Placed in service</Label>
        <Input
          id="placed_in_service"
          type="date"
          value={placedInService}
          onChange={(e) => setPlacedInService(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="depreciable_basis">Depreciable basis ($)</Label>
        <Input
          id="depreciable_basis"
          inputMode="decimal"
          value={depreciableBasis}
          onChange={(e) => setDepreciableBasis(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="annual_depreciation">Annual depreciation ($)</Label>
        <Input
          id="annual_depreciation"
          inputMode="decimal"
          value={annualDepreciation}
          onChange={(e) => setAnnualDepreciation(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? 'Saving…' : 'Save changes'}
      </Button>
      <BusyBar active={busy} />

      <DangerZone propertyId={property.id} address={property.address} />
    </form>
  );
}

function DangerZone({ propertyId, address }: { propertyId: string; address: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    const confirmation = window.prompt(
      `This will permanently delete ${address} and EVERYTHING tied to it:\n\n` +
        '• Leases and tenant links\n' +
        '• Rent payments and auto-pay subscriptions (will be canceled in Stripe)\n' +
        '• Expenses and receipt photos\n' +
        '• Work orders and photos\n' +
        '• Documents and the property photo\n' +
        '• Appliances and reminders\n\n' +
        "If you need records for taxes, download the Tax export from Reports FIRST.\n\n" +
        'To confirm, type DELETE below.',
    );
    if (confirmation !== 'DELETE') return;
    setBusy(true);
    setError(null);
    try {
      await deleteProperty(propertyId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete property');
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
      <p className="text-sm font-semibold text-destructive">Delete property</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Permanently removes this property and all leases, payments, expenses, work orders,
        documents, and photos attached to it. This can&apos;t be undone — download a tax export
        first if you need records.
      </p>
      <Button
        type="button"
        variant="outline"
        onClick={handleDelete}
        disabled={busy}
        className="mt-3 w-full text-destructive hover:bg-destructive/10"
      >
        {busy ? 'Deleting…' : 'Delete property'}
      </Button>
      <BusyBar active={busy} />
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
