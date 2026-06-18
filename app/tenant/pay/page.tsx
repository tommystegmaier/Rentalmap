import Link from 'next/link';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { cardChargeCents } from '@/lib/utils';
import { format } from 'date-fns';
import { nextUnpaidRentPeriod, rentPeriodOptions } from '@/lib/rent-period';
import { getStripe } from '@/lib/stripe';
import { ClipboardList } from 'lucide-react';
import { PayPageContent } from './pay-page-content';

export default async function PayRentPage({
  searchParams,
}: {
  searchParams: { autopay?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: leaseLinks } = await supabase
    .from('lease_tenants')
    .select(
      'lease_id, leases:lease_id(id, monthly_rent_cents, due_day, properties:property_id(address, owner_id))',
    )
    .eq('user_id', user!.id);

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
  const prop = lease
    ? Array.isArray(lease.properties)
      ? lease.properties[0]
      : lease.properties
    : null;

  let landlordConnected = false;
  let landlordHasAccount = false;
  let achFeePayer: 'landlord' | 'tenant' = 'landlord';
  let cardFeePayer: 'landlord' | 'tenant' = 'tenant';
  if (prop?.owner_id) {
    const admin = createServiceRoleClient();
    const { data: landlord } = await admin
      .from('users')
      .select('stripe_connect_account_id, ach_fee_payer, card_fee_payer')
      .eq('id', prop.owner_id)
      .maybeSingle();
    if (landlord?.stripe_connect_account_id) {
      landlordHasAccount = true;
      try {
        const stripe = getStripe();
        const account = await stripe.accounts.retrieve(landlord.stripe_connect_account_id);
        landlordConnected = account.charges_enabled;
      } catch {
        landlordConnected = false;
      }
    }
    if (landlord?.ach_fee_payer) achFeePayer = landlord.ach_fee_payer as 'landlord' | 'tenant';
    if (landlord?.card_fee_payer) cardFeePayer = landlord.card_fee_payer as 'landlord' | 'tenant';
  }

  const ACH_FEE_CENTS = 80;
  const achTotalCents = lease
    ? achFeePayer === 'tenant'
      ? lease.monthly_rent_cents + ACH_FEE_CENTS
      : lease.monthly_rent_cents
    : 0;
  const cardTotalCents = lease
    ? cardFeePayer === 'tenant'
      ? cardChargeCents(lease.monthly_rent_cents)
      : lease.monthly_rent_cents
    : 0;

  let autopay: { id: string; status: string } | null = null;
  type LateFeeRow = { id: string; charge_date: string; amount_cents: number; period_start: string };
  let lateFees: LateFeeRow[] = [];
  let paidExpectedDates: string[] = [];

  if (lease) {
    const [{ data: autopayData }, { data: feeData }, { data: paidDatesData }] = await Promise.all([
      supabase
        .from('autopay_subscriptions')
        .select('id, status')
        .eq('lease_id', lease.id)
        .eq('tenant_user_id', user!.id)
        .eq('status', 'active')
        .maybeSingle(),
      supabase
        .from('late_fee_charges')
        .select('id, charge_date, amount_cents, period_start')
        .eq('lease_id', lease.id)
        .eq('waived', false)
        .order('charge_date', { ascending: false }),
      supabase
        .from('rent_payments')
        .select('expected_date')
        .eq('lease_id', lease.id)
        .in('status', ['settled', 'manual']),
    ]);
    autopay = autopayData as { id: string; status: string } | null;
    lateFees = (feeData ?? []) as LateFeeRow[];
    paidExpectedDates = (paidDatesData ?? []).map((p: { expected_date: string }) => p.expected_date);
  }

  const today = new Date();
  const defaultPeriodDue = lease
    ? nextUnpaidRentPeriod(lease.due_day, paidExpectedDates, today)
    : today;
  const defaultExpectedDate = format(defaultPeriodDue, 'yyyy-MM-dd');
  const periodOptions = lease
    ? rentPeriodOptions(lease.due_day, paidExpectedDates)
    : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Pay rent" description={prop?.address ?? ''} />

      {searchParams.autopay === 'on' ? (
        <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm">
          Auto-pay is set up. You&apos;ll be charged automatically each month.
        </div>
      ) : null}

      {lease ? (
        <PayPageContent
          leaseId={lease.id}
          monthlyCents={lease.monthly_rent_cents}
          achTotalCents={achTotalCents}
          cardTotalCents={cardTotalCents}
          achFeePayer={achFeePayer}
          cardFeePayer={cardFeePayer}
          landlordConnected={landlordConnected}
          landlordHasAccount={landlordHasAccount}
          autopay={autopay}
          lateFees={lateFees}
          periodOptions={periodOptions}
          defaultExpectedDate={defaultExpectedDate}
        />
      ) : (
        <p className="text-sm text-muted-foreground">No active lease found.</p>
      )}

      <div className="flex justify-center">
        <Link
          href="/tenant/inspections"
          className="flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <ClipboardList size={13} />
          View inspection records
        </Link>
      </div>

      <p className="text-xs text-muted-foreground">
        Online payments are processed by Stripe. It Rents never sees or stores your card or
        bank details.
      </p>
    </div>
  );
}
