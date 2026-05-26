'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { updateVendor, deleteVendor } from './actions';

const EIN_REGEX = /^\d{2}-\d{7}$/;

interface EditVendorFormProps {
  vendor: {
    id: string;
    name: string;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    ein: string | null;
    ssn_last4: string | null;
    email: string | null;
    phone: string | null;
    notes: string | null;
  };
}

export function EditVendorForm({ vendor }: EditVendorFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isIndividual, setIsIndividual] = useState(!!vendor.ssn_last4);
  const [ein, setEin] = useState(vendor.ein ?? '');
  const [error, setError] = useState<string | null>(null);

  function handleEinChange(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 9);
    if (digits.length <= 2) {
      setEin(digits);
    } else {
      setEin(`${digits.slice(0, 2)}-${digits.slice(2)}`);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!isIndividual && ein && !EIN_REGEX.test(ein)) {
      setError('EIN must be in the format XX-XXXXXXX (e.g. 12-3456789).');
      return;
    }

    const formData = new FormData(e.currentTarget);
    if (!isIndividual) {
      formData.set('ein', ein);
    }

    startTransition(async () => {
      try {
        await updateVendor(vendor.id, formData);
        router.push(`/landlord/vendors/${vendor.id}`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save vendor.');
      }
    });
  }

  async function handleDelete() {
    if (!confirm('Delete this vendor? This cannot be undone.')) return;
    startTransition(async () => {
      try {
        await deleteVendor(vendor.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete vendor.');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name <span className="text-destructive">*</span></Label>
        <Input id="name" name="name" required defaultValue={vendor.name} />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_individual"
          name="is_individual"
          checked={isIndividual}
          onChange={(e) => setIsIndividual(e.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
        <Label htmlFor="is_individual" className="cursor-pointer font-normal">
          Individual contractor (use SSN instead of EIN)
        </Label>
      </div>

      {isIndividual ? (
        <div className="space-y-2">
          <Label htmlFor="ssn_last4">SSN last 4 digits</Label>
          <Input
            id="ssn_last4"
            name="ssn_last4"
            defaultValue={vendor.ssn_last4 ?? ''}
            placeholder="1234"
            maxLength={4}
            pattern="\d{4}"
            inputMode="numeric"
          />
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="ein">EIN (XX-XXXXXXX)</Label>
          <Input
            id="ein"
            name="ein"
            value={ein}
            onChange={(e) => handleEinChange(e.target.value)}
            placeholder="12-3456789"
            inputMode="numeric"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Input id="address" name="address" defaultValue={vendor.address ?? ''} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" defaultValue={vendor.city ?? ''} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">State</Label>
          <Input id="state" name="state" maxLength={2} defaultValue={vendor.state ?? ''} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="zip">ZIP Code</Label>
        <Input id="zip" name="zip" defaultValue={vendor.zip ?? ''} inputMode="numeric" maxLength={10} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" defaultValue={vendor.email ?? ''} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" name="phone" type="tel" defaultValue={vendor.phone ?? ''} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={3} defaultValue={vendor.notes ?? ''} />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Saving…' : 'Save changes'}
      </Button>

      <Button
        type="button"
        variant="outline"
        onClick={handleDelete}
        disabled={isPending}
        className="w-full text-destructive hover:bg-destructive/10"
      >
        <Trash2 size={14} /> Delete vendor
      </Button>
    </form>
  );
}
