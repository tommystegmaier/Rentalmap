import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { formatCents } from '@/lib/utils';
import { format } from 'date-fns';
import { currentRentPeriodDue } from '@/lib/rent-period';
import { ChevronLeft } from 'lucide-react';
import { BackButton } from '@/components/back-button';
import {
  P2P_LABELS,
  handleForMethod,
  isP2PMethod,
  type LandlordHandles,
  type P2PMethod,
} from '@/lib/p2p';
import { P2PClaimForm } from './form';

export default async function P2PClaimPage({
  searchParams,
}: {
  searchParams: { method?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const method: P2PMethod = isP2PMethod(searchParams.method) ? searchParams.method : 'venmo';
  const methodLabel = P2P_LABELS[method];

  const { data: leaseLinks } = await supabase
    .from('lease_tenants')
    .select(
      'lease_id, leases:lease_id(id, monthly_rent_cents, due_day, properties:property_id(address, owner_id))',
    )
    .eq('user_id', user.id);

  const rawLease = leaseLinks?.[0]?.leases;
  const leaseRow = Array.isArray(rawLease) ? rawLease[0] : rawLease;
  const lease = leaseRow as
    | {
        id: string;
        monthly_rent_cents: number;
        due_day: number;
        properties:
          | { address: string; owner_id: string }
          | { address: string; owner_id: string }[]
          | null;
      }
    | null
    | undefined;

  if (!lease) {
    return (
      <div className="space-y-4">
        <PageHeader title={`Log ${methodLabel} payment`} />
        <p className="text-sm text-muted-foreground">No active lease found.</p>
      </div>
    );
  }

  const prop = Array.isArray(lease.properties) ? lease.properties[0] : lease.properties;

  // Look up the landlord's handle for this method (service role — tenant can't read landlord row).
  let handle: string | null = null;
  if (prop?.owner_id) {
    const admin = createServiceRoleClient();
    const { data: landlord } = await admin
      .from('users')
      .select('venmo_handle, cashapp_cashtag, zelle_handle')
      .eq('id', prop.owner_id)
      .maybeSingle();
    if (landlord) handle = handleForMethod(method, landlord as LandlordHandles);
  }

  const today = new Date();
  const periodDue = currentRentPeriodDue(lease.due_day, today);
  const expectedDate = format(periodDue, 'yyyy-MM-dd');
  const periodLabel = format(periodDue, 'MMMM yyyy');
  const note = `${periodLabel} rent${prop?.address ? ` · ${prop.address}` : ''}`;

  // Check for an existing pending claim for this period (any method)
  const { data: existing } = await supabase
    .from('venmo_payment_claims')
    .select('id')
    .eq('lease_id', lease.id)
    .eq('expected_date', expectedDate)
    .eq('status', 'pending')
    .maybeSingle();

  return (
    <div className="space-y-6">
      <BackButton fallback="/tenant/pay" label="Pay rent" />

      <PageHeader title={`Log ${methodLabel} payment`} description={prop?.address ?? ''} />

      {existing ? (
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm">
          You already have a pending payment claim for {periodLabel}. Your landlord will confirm
          or deny it shortly.
        </div>
      ) : null}

      <Card>
        <CardContent className="space-y-1 p-4 text-sm">
          <p className="font-medium">Amount</p>
          <p className="text-2xl font-semibold">{formatCents(lease.monthly_rent_cents)}</p>
          <p className="text-xs text-muted-foreground">
            For {periodLabel} · due {format(periodDue, 'MMMM d')}
          </p>
        </CardContent>
      </Card>

      <P2PClaimForm
        method={method}
        handle={handle}
        leaseId={lease.id}
        amountCents={lease.monthly_rent_cents}
        expectedDate={expectedDate}
        note={note}
        hasPending={!!existing}
      />

      <p className="text-xs text-muted-foreground">
        Your landlord will receive a notification and confirm or deny the payment. Once approved,
        it&apos;s logged as paid for {periodLabel}.
      </p>
    </div>
  );
}
