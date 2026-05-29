import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { mileageRateForYear, MILEAGE_PURPOSES } from '@/lib/mileage';
import { createMileageTrip } from './actions';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

export default async function NewMileagePage({
  searchParams,
}: {
  searchParams: { property_id?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: properties } = await supabase
    .from('properties')
    .select('id, address')
    .eq('owner_id', user.id)
    .order('created_at');

  const propertyList = (properties ?? []) as { id: string; address: string }[];
  if (propertyList.length === 0) redirect('/landlord/properties');

  const today = new Date().toISOString().slice(0, 10);
  const defaultRate = mileageRateForYear(new Date().getFullYear());
  const preselected =
    searchParams.property_id &&
    propertyList.some((p) => p.id === searchParams.property_id)
      ? searchParams.property_id
      : propertyList[0].id;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Log a trip"
        description="Track deductible miles driven for a rental"
      />

      <form action={createMileageTrip} className="space-y-4">
        <input
          type="hidden"
          name="return_property_id"
          value={searchParams.property_id ?? ''}
        />

        <Field label="Property">
          <select
            name="property_id"
            required
            defaultValue={preselected}
            className="h-11 w-full rounded-lg border border-input bg-background px-3"
          >
            {propertyList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.address}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Miles (one way)">
            <input
              type="number"
              step="0.1"
              min="0"
              name="miles"
              required
              placeholder="0.0"
              className="h-11 w-full rounded-lg border border-input bg-background px-3"
            />
          </Field>
          <Field label="Trip date">
            <input
              type="date"
              name="trip_date"
              defaultValue={today}
              className="h-11 w-full rounded-lg border border-input bg-background px-3"
            />
          </Field>
        </div>

        <label className="flex items-center gap-3 rounded-lg border p-3 tap-44">
          <input type="checkbox" name="round_trip" defaultChecked className="h-4 w-4" />
          <span className="flex-1 text-sm">
            <span className="font-medium">Round trip</span>
            <span className="block text-xs text-muted-foreground">
              Doubles the miles above to count the drive there and back.
            </span>
          </span>
        </label>

        <Field label="Purpose">
          <select
            name="purpose"
            defaultValue={MILEAGE_PURPOSES[0]}
            className="h-11 w-full rounded-lg border border-input bg-background px-3"
          >
            {MILEAGE_PURPOSES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Rate (¢ per mile)">
          <input
            type="number"
            step="0.1"
            min="0"
            name="rate"
            required
            defaultValue={defaultRate}
            className="h-11 w-full rounded-lg border border-input bg-background px-3"
          />
        </Field>
        <p className="-mt-2 text-xs text-muted-foreground">
          Pre-filled with the current IRS standard rate ({defaultRate}¢/mi). Adjust it if your
          trip was in a year with a different rate.
        </p>

        <Field label="Notes (optional)">
          <textarea
            name="notes"
            rows={3}
            placeholder="e.g. Drove to meet the HVAC tech for the spring service."
            className="w-full rounded-lg border border-input bg-background px-3 py-2"
          />
        </Field>

        <Button type="submit" className="w-full">
          Save trip
        </Button>
      </form>
    </div>
  );
}
