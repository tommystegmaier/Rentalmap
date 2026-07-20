import Link from 'next/link';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cardChargeCents, formatCents } from '@/lib/utils';
import { addMonths, format, parseISO, setDate } from 'date-fns';
import { PayButton } from './pay-button';
import { AutopayControls } from './autopay-controls';
import { getStripe } from '@/lib/stripe';
import { AlertCircle, ClipboardList } from 'lucide-react';

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

  let autopay: { id: string; status: string } | null = null;
  type LateFeeRow = { id: string; charge_date: string; amount_cents: number; period_start: string };
  let lateFees: LateFeeRow[] = [];

  if (lease) {
    const [{ data: autopayData }, { data: feeData }] = await Promise.all([
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
        .eq('paid', false)
        .order('charge_date', { ascending: false }),
    ]);
    autopay = autopayData as { id: string; status: string } | null;
    lateFees = (feeData ?? []) as LateFeeRow[];
  }

  const totalLateFeesCents = lateFees.reduce((s, f) => s + f.amount_cents, 0);

  // The tenant owes rent plus any outstanding late fees. Processing fees are
  // computed on that combined base so the landlord nets the full amount.
  const rentCents = lease?.monthly_rent_cents ?? 0;
  const baseDueCents = rentCents + totalLateFeesCents;

  const ACH_FEE_CENTS = 80;
  const achTotalCents = lease
    ? achFeePayer === 'tenant'
      ? baseDueCents + ACH_FEE_CENTS
      : baseDueCents
    : 0;
  const cardTotalCents = lease
    ? cardFeePayer === 'tenant'
      ? cardChargeCents(baseDueCents)
      : baseDueCents
    : 0;

  const today = new Date();
  let nextDue = lease ? setDate(today, lease.due_day) : today;
  if (lease && nextDue < today) nextDue = addMonths(nextDue, 1);
  const expectedDate = format(nextDue, 'yyyy-MM-dd');

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
            {lease ? formatCents(baseDueCents) : '—'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Next due {format(nextDue, 'MMMM d, yyyy')}
          </p>
          {totalLateFeesCents > 0 && lease ? (
            <div className="mt-3 space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Rent</span>
                <span>{formatCents(rentCents)}</span>
              </div>
              <div className="flex items-center justify-between text-destructive">
                <span className="flex items-center gap-1.5">
                  <AlertCircle size={14} className="shrink-0" />
                  Late fees
                </span>
                <span className="font-medium">{formatCents(totalLateFeesCents)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-destructive/20 pt-1 font-medium">
                <span>Total due</span>
                <span>{formatCents(baseDueCents)}</span>
              </div>
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
                    ? `Includes a 2.9% + $0.30 processing fee (${formatCents(cardTotalCents - baseDueCents)}). Clears immediately. Apple Pay and Cash App available at checkout.`
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

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Paid via Venmo?</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Already sent the payment through Venmo? Let your landlord know — they&apos;ll
            confirm receipt and it gets logged automatically.
          </p>
          {lease ? (
            <Link
              href="/tenant/pay/venmo"
              className="block w-full rounded-lg border px-4 py-2 text-center text-sm font-medium transition hover:bg-muted/30"
            >
              Log a Venmo payment
            </Link>
          ) : null}
        </CardContent>
      </Card>

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
