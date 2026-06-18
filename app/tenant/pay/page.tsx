import Link from 'next/link';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cardChargeCents, formatCents } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { nextUnpaidRentPeriod } from '@/lib/rent-period';
import { PayButton } from './pay-button';
import { AutopayControls } from './autopay-controls';
import { getStripe } from '@/lib/stripe';
import { AlertCircle, ClipboardList, ChevronRight } from 'lucide-react';
import { P2P_METHODS, P2P_LABELS } from '@/lib/p2p';

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

  // Look up landlord's Stripe connect status (service role — tenant can't read landlord row).
  // We check charges_enabled via Stripe API, not just whether an ID is stored in the DB,
  // so the UI correctly reflects whether payments can actually be accepted.
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

  const totalLateFeesCents = lateFees.reduce((s, f) => s + f.amount_cents, 0);

  const today = new Date();
  const periodDue = lease ? nextUnpaidRentPeriod(lease.due_day, paidExpectedDates, today) : today;
  const expectedDate = format(periodDue, 'yyyy-MM-dd');
  const payingEarly = periodDue > today;

  return (
    <div className="space-y-6">
      <PageHeader title="Pay rent" description={prop?.address ?? ''} />

      {searchParams.autopay === 'on' ? (
        <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm">
          Auto-pay is set up. You&apos;ll be charged automatically each month.
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Amount due</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold">
            {lease ? formatCents(lease.monthly_rent_cents) : '—'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            For {format(periodDue, 'MMMM yyyy')} · due {format(periodDue, 'MMMM d')}
          </p>
          {payingEarly ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Paying early — this month&apos;s rent is already settled.
            </p>
          ) : null}
          {totalLateFeesCents > 0 ? (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle size={15} className="shrink-0" />
              <span>
                <strong>{formatCents(totalLateFeesCents)}</strong> in outstanding late fees — see below.
              </span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {lease ? (
        landlordConnected ? (
          <Card>
            <CardHeader>
              <CardTitle>Pay securely with Stripe</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="rounded-xl border bg-card p-4 space-y-2">
                <div className="flex items-baseline justify-between">
                  <p className="font-medium">Pay with bank (ACH)</p>
                  <p className="text-lg font-semibold">{formatCents(achTotalCents)}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {achFeePayer === 'tenant'
                    ? `Includes a $0.80 processing fee. Settles in 1–3 business days.`
                    : 'No fee for you. Settles in 1–3 business days.'}
                </p>
                <PayButton
                  leaseId={lease.id}
                  expectedDate={expectedDate}
                  method="ach"
                  label={`Pay ${formatCents(achTotalCents)} by bank`}
                />
              </div>

              <div className="rounded-xl border bg-card p-4 space-y-2">
                <div className="flex items-baseline justify-between">
                  <p className="font-medium">Card · Apple Pay · Cash App</p>
                  <p className="text-lg font-semibold">{formatCents(cardTotalCents)}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {cardFeePayer === 'tenant'
                    ? `Includes a 2.9% + $0.30 processing fee (${formatCents(cardTotalCents - lease.monthly_rent_cents)}). Clears immediately. Apple Pay and Cash App available at checkout.`
                    : 'No fee for you. Clears immediately. Apple Pay and Cash App available at checkout.'}
                </p>
                <PayButton
                  leaseId={lease.id}
                  expectedDate={expectedDate}
                  method="card"
                  variant="outline"
                  label={`Pay ${formatCents(cardTotalCents)} by card / Apple Pay`}
                />
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-4 text-sm">
              <p className="text-muted-foreground">
                {landlordHasAccount
                  ? "Your landlord's payment account is being verified by Stripe and isn't ready yet. Please continue paying via Zelle, Venmo, or check in the meantime."
                  : "Your landlord hasn't set up online payments yet. Please continue paying via Zelle, Venmo, or check; payments will be logged here."}
              </p>
            </CardContent>
          </Card>
        )
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Auto-pay</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Authorize Stripe to charge rent automatically each month. Cancel any time.
          </p>
          {lease ? (
            <AutopayControls
              leaseId={lease.id}
              autopay={autopay}
              landlordConnected={landlordConnected}
            />
          ) : null}
        </CardContent>
      </Card>

      {lease ? (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div>
              <p className="text-sm font-medium">Pay by Venmo, Cash App, or Zelle</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Fee-free. Send the payment, then confirm it here — your landlord approves it and
                it gets logged automatically.
              </p>
            </div>

            <div className="space-y-2">
              {P2P_METHODS.map((m) => (
                <Link
                  key={m}
                  href={`/tenant/pay/p2p?method=${m}`}
                  className="flex items-center justify-between gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition hover:bg-muted/30"
                >
                  <span>Pay with {P2P_LABELS[m]}</span>
                  <ChevronRight size={16} className="text-muted-foreground" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {lateFees.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle size={18} />
              Outstanding late fees
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {lateFees.map((fee) => (
              <div
                key={fee.id}
                className="flex items-center justify-between gap-2 border-b py-2.5 last:border-0"
              >
                <div>
                  <p className="font-medium">{formatCents(fee.amount_cents)}</p>
                  <p className="text-xs text-muted-foreground">
                    Period starting {format(parseISO(fee.period_start), 'MMM d, yyyy')}
                  </p>
                </div>
                <span className="text-xs text-destructive font-medium">Due</span>
              </div>
            ))}
            <p className="pt-2 text-xs text-muted-foreground">
              Contact your landlord to arrange payment or request a waiver.
            </p>
          </CardContent>
        </Card>
      ) : null}

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
