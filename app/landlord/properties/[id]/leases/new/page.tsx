import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { createLease } from './actions';

export default async function NewLeasePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: property } = await supabase
    .from('properties')
    .select('id, address, asking_rent_cents')
    .eq('id', params.id)
    .maybeSingle();
  if (!property) notFound();

  const defaultRent =
    property.asking_rent_cents != null
      ? (property.asking_rent_cents / 100).toFixed(0)
      : '';

  async function action(formData: FormData) {
    'use server';
    await createLease(params.id, formData);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="New lease" description={property.address} />

      <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
        Capture the lease <strong className="text-foreground">terms</strong> here (dates, rent,
        late fee). Once saved, you can upload the signed PDF from the property&apos;s Documents
        section and share it with the tenant.
      </div>

      <form action={action} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="start_date">Start date *</Label>
            <Input id="start_date" name="start_date" type="date" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end_date">End date *</Label>
            <Input id="end_date" name="end_date" type="date" required />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="monthly_rent">Monthly rent ($) *</Label>
          <Input
            id="monthly_rent"
            name="monthly_rent"
            inputMode="decimal"
            required
            defaultValue={defaultRent}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="due_day">Due day of month</Label>
            <Input
              id="due_day"
              name="due_day"
              type="number"
              min={1}
              max={28}
              defaultValue={1}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="late_after_day">Late after day</Label>
            <Input
              id="late_after_day"
              name="late_after_day"
              type="number"
              min={1}
              max={28}
              defaultValue={5}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="late_fee">Late fee ($)</Label>
            <Input
              id="late_fee"
              name="late_fee"
              inputMode="decimal"
              defaultValue={50}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="security_deposit">Security deposit ($)</Label>
            <Input
              id="security_deposit"
              name="security_deposit"
              inputMode="decimal"
              placeholder="usually 1 month rent"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="utilities_paid_by">Utilities paid by</Label>
            <Select
              id="utilities_paid_by"
              name="utilities_paid_by"
              defaultValue="tenant"
            >
              <option value="tenant">Tenant</option>
              <option value="landlord">Landlord</option>
              <option value="shared">Shared</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lawn_care_by">Lawn care by</Label>
            <Select id="lawn_care_by" name="lawn_care_by" defaultValue="tenant">
              <option value="tenant">Tenant</option>
              <option value="landlord">Landlord</option>
              <option value="shared">Shared</option>
            </Select>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="pets_allowed" className="h-4 w-4" />
          Pets allowed
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="late_fee_enabled" className="h-4 w-4" />
          Auto-charge late fee after grace period
          <span className="text-xs text-muted-foreground">(runs nightly)</span>
        </label>

        <div className="space-y-2">
          <Label htmlFor="terms_notes">Terms / notes</Label>
          <Textarea
            id="terms_notes"
            name="terms_notes"
            rows={5}
            placeholder="Any custom clauses, e.g. quarterly inspections, holdover terms, renewal options."
          />
        </div>

        <Button type="submit" className="w-full">
          Create lease
        </Button>
      </form>
    </div>
  );
}
