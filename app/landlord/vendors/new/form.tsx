'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createVendor } from './actions';

const EIN_REGEX = /^\d{2}-\d{7}$/;

export function NewVendorForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isIndividual, setIsIndividual] = useState(false);
  const [ein, setEin] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleEinChange(value: string) {
    // Auto-format EIN: insert hyphen after 2 digits
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
    // Sync the formatted EIN back into formData
    if (!isIndividual) {
      formData.set('ein', ein);
    }

    startTransition(async () => {
      try {
        await createVendor(formData);
        router.push('/landlord/vendors');
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save vendor.');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name <span className="text-destructive">*</span></Label>
        <Input id="name" name="name" required placeholder="Acme Plumbing LLC" />
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
            placeholder="1234"
            maxLength={4}
            pattern="\d{4}"
            inputMode="numeric"
          />
          <p className="text-xs text-muted-foreground">
            Only the last 4 digits are stored for identification.
          </p>
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
        <Input id="address" name="address" placeholder="123 Main St" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">State</Label>
          <Input id="state" name="state" maxLength={2} placeholder="OK" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="zip">ZIP Code</Label>
        <Input id="zip" name="zip" placeholder="73008" inputMode="numeric" maxLength={10} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" placeholder="vendor@example.com" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" name="phone" type="tel" placeholder="(405) 555-0100" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={3} placeholder="License #, specialty, etc." />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex gap-3">
        <Button type="submit" className="flex-1" disabled={isPending}>
          {isPending ? 'Saving…' : 'Save vendor'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
