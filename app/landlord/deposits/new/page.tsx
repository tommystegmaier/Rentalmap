import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { one } from '@/lib/utils';
import { createDeposit } from './actions';

interface LeaseOption {
  id: string;
  monthly_rent_cents: number;
  start_date: string;
  properties: { address: string } | { address: string }[] | null;
  tenants: { users: { name: string | null } | { name: string | null }[] | null }[] | null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

export default async function NewDepositPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: leases } = await supabase
    .from('leases')
    .select(
      'id, monthly_rent_cents, start_date, properties:property_id(address), tenants:lease_tenants(users:user_id(name))',
    )
    .eq('status', 'active')
    .eq('properties.owner_id', user!.id);

  // Filter to leases where the property belongs to this landlord
  // (PostgREST inner filter on embedded table)
  const { data: ownedLeases } = await supabase
    .from('leases')
    .select(
      'id, monthly_rent_cents, start_date, properties:property_id!inner(address), tenants:lease_tenants(users:user_id(name))',
    )
    .eq('properties.owner_id', user!.id);

  const leasesToShow = (ownedLeases ?? leases ?? []) as LeaseOption[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Record security deposit"
        description="Log a deposit received from a tenant"
      />

      {leasesToShow.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No active leases found. Add a property and lease first.
        </p>
      ) : (
        <form action={createDeposit} className="space-y-4">
          <Field label="Lease / Property">
            <select
              name="lease_id"
              required
              defaultValue={leasesToShow[0]?.id ?? ''}
              className="h-11 w-full rounded-lg border border-input bg-background px-3"
            >
              {leasesToShow.map((l) => {
                const prop = one(l.properties);
                const addr = prop?.address ?? '—';
                const firstTenant = l.tenants?.[0];
                const tenantUser = firstTenant ? one(firstTenant.users) : null;
                const tenantName = tenantUser?.name;
                return (
                  <option key={l.id} value={l.id}>
                    {addr}
                    {tenantName ? ` — ${tenantName}` : ''}
                    {` (started ${l.start_date})`}
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
                min="0"
                name="amount"
                required
                placeholder="0.00"
                className="h-11 w-full rounded-lg border border-input bg-background px-3"
              />
            </Field>
            <Field label="Received date">
              <input
                type="date"
                name="received_date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                className="h-11 w-full rounded-lg border border-input bg-background px-3"
              />
            </Field>
          </div>

          <Field label="Holding institution (optional)">
            <input
              type="text"
              name="holding_institution"
              placeholder="e.g. Chase escrow account"
              className="h-11 w-full rounded-lg border border-input bg-background px-3"
            />
          </Field>

          <Field label="Annual interest rate % (default 0)">
            <input
              type="number"
              step="0.0001"
              min="0"
              name="interest_rate_pct"
              defaultValue="0"
              className="h-11 w-full rounded-lg border border-input bg-background px-3"
            />
          </Field>

          <Field label="Notes (optional)">
            <textarea
              name="notes"
              rows={3}
              placeholder="Any additional details…"
              className="w-full rounded-lg border border-input bg-background px-3 py-2"
            />
          </Field>

          <Button type="submit" className="w-full">
            Save deposit
          </Button>
        </form>
      )}
    </div>
  );
}
