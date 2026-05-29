import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { one } from '@/lib/utils';
import { logRentPayment } from './actions';

interface LeaseOption {
  id: string;
  monthly_rent_cents: number;
  properties: { address: string } | { address: string }[] | null;
}

export default async function NewRentPaymentPage() {
  const supabase = createClient();
  const { data: leases } = await supabase
    .from('leases')
    .select('id, monthly_rent_cents, properties:property_id(address)')
    .eq('status', 'active');

  if (!leases || leases.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader title="Log rent payment" />
        <p className="text-sm text-muted-foreground">
          No active leases. Seed your property first.
        </p>
        <Button asChild variant="outline">
          <Link href="/landlord">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  async function action(formData: FormData) {
    'use server';
    await logRentPayment(formData);
    redirect('/landlord/rent');
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Log rent payment" description="For payments received outside the app" />
      <form action={action} className="space-y-4">
        <Field label="Lease">
          <select
            name="lease_id"
            required
            defaultValue={leases[0].id}
            className="h-11 w-full rounded-lg border border-input bg-background px-3"
          >
            {(leases as LeaseOption[]).map((l) => {
              const addr = one(l.properties)?.address ?? '—';
              return (
                <option key={l.id} value={l.id}>
                  {addr} (${(l.monthly_rent_cents / 100).toFixed(0)}/mo)
                </option>
              );
            })}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount ($)">
            <input
              type="number"
              step="0.01"
              name="amount"
              required
              defaultValue={(leases[0].monthly_rent_cents / 100).toFixed(2)}
              className="h-11 w-full rounded-lg border border-input bg-background px-3"
            />
          </Field>
          <Field label="Received date">
            <input
              type="date"
              name="received_date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="h-11 w-full rounded-lg border border-input bg-background px-3"
            />
          </Field>
        </div>

        <Field label="Method">
          <select
            name="method"
            required
            defaultValue="zelle"
            className="h-11 w-full rounded-lg border border-input bg-background px-3"
          >
            <option value="zelle">Zelle</option>
            <option value="venmo">Venmo</option>
            <option value="cashapp">Cash App</option>
            <option value="check">Check</option>
            <option value="cash">Cash</option>
            <option value="other">Other</option>
          </select>
        </Field>

        <Field label="Notes (optional)">
          <textarea
            name="notes"
            rows={3}
            className="w-full rounded-lg border border-input bg-background px-3 py-2"
          />
        </Field>

        <Button type="submit" className="w-full">
          Save payment
        </Button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
