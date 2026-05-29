import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { ChevronLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCents, one } from '@/lib/utils';
import { format, parseISO, differenceInDays } from 'date-fns';
import { UpdateDepositForm } from './update-form';

type DepositStatus =
  | 'holding'
  | 'returned'
  | 'partially_returned'
  | 'applied_to_damages'
  | 'forfeited';

function statusBadgeClass(status: DepositStatus): string {
  switch (status) {
    case 'holding':
      return 'border-blue-300 bg-blue-50 text-blue-700';
    case 'returned':
      return 'border-green-300 bg-green-50 text-green-700';
    case 'partially_returned':
      return 'border-yellow-300 bg-yellow-50 text-yellow-700';
    case 'applied_to_damages':
      return 'border-red-300 bg-red-50 text-red-700';
    case 'forfeited':
      return 'border-red-300 bg-red-50 text-red-700';
    default:
      return 'border-muted bg-muted/30 text-muted-foreground';
  }
}

function statusLabel(status: DepositStatus): string {
  switch (status) {
    case 'holding':
      return 'Holding';
    case 'returned':
      return 'Returned';
    case 'partially_returned':
      return 'Partial return';
    case 'applied_to_damages':
      return 'Applied to damages';
    case 'forfeited':
      return 'Forfeited';
    default:
      return status;
  }
}

interface DeductionItem {
  label: string;
  amount_cents: number;
}

export default async function DepositDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const { data: deposit } = await supabase
    .from('security_deposits')
    .select(
      `id, amount_cents, received_date, holding_institution, interest_rate_pct,
       interest_accrued_cents, last_interest_calc, status, returned_date,
       returned_amount_cents, deduction_items, notes,
       leases:lease_id(
         start_date, end_date, monthly_rent_cents,
         properties:property_id(address),
         tenants:lease_tenants(users:user_id(name))
       )`,
    )
    .eq('id', params.id)
    .maybeSingle();

  if (!deposit) notFound();

  // Resolve nested joins (PostgREST may return single or array)
  type LeaseRow = {
    start_date: string;
    end_date: string | null;
    monthly_rent_cents: number;
    properties: { address: string } | { address: string }[] | null;
    tenants: { users: { name: string | null } | { name: string | null }[] | null }[] | null;
  };
  const lease = one(deposit.leases as unknown as LeaseRow | LeaseRow[] | null);
  const property = lease ? one(lease.properties) : null;
  const address = property?.address ?? '—';
  const firstTenant = lease?.tenants?.[0];
  const tenantUser = firstTenant ? one(firstTenant.users) : null;
  const tenantName = tenantUser?.name;

  // Compute accrued interest: principal * (rate/100) / 365 * days since last calc
  let pendingInterestCents = 0;
  const interestRatePct = Number(deposit.interest_rate_pct ?? 0);
  if (interestRatePct > 0) {
    const calcFrom = deposit.last_interest_calc
      ? parseISO(deposit.last_interest_calc)
      : deposit.received_date
        ? parseISO(deposit.received_date)
        : null;
    if (calcFrom) {
      const days = differenceInDays(new Date(), calcFrom);
      if (days > 0) {
        pendingInterestCents = Math.floor(
          (deposit.amount_cents * (interestRatePct / 100) * days) / 365,
        );
      }
    }
  }

  const deductionItems: DeductionItem[] = Array.isArray(deposit.deduction_items)
    ? (deposit.deduction_items as DeductionItem[])
    : [];

  const totalDeductions = deductionItems.reduce((sum, d) => sum + d.amount_cents, 0);

  return (
    <div className="space-y-6">
      <Link
        href="/landlord/deposits"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft size={16} />
        Security deposits
      </Link>
      <PageHeader
        title="Security Deposit"
        description={address}
      />

      {/* Summary card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Deposit summary</CardTitle>
            <Badge className={statusBadgeClass(deposit.status as DepositStatus)}>
              {statusLabel(deposit.status as DepositStatus)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Property</p>
              <p className="font-medium">{address}</p>
            </div>
            {tenantName && (
              <div>
                <p className="text-xs text-muted-foreground">Tenant</p>
                <p className="font-medium">{tenantName}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Deposit amount</p>
              <p className="font-medium">{formatCents(deposit.amount_cents, { withCents: true })}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Received date</p>
              <p className="font-medium">
                {deposit.received_date
                  ? format(parseISO(deposit.received_date), 'MMM d, yyyy')
                  : '—'}
              </p>
            </div>
            {deposit.holding_institution && (
              <div>
                <p className="text-xs text-muted-foreground">Held at</p>
                <p className="font-medium">{deposit.holding_institution}</p>
              </div>
            )}
            {lease && (
              <div>
                <p className="text-xs text-muted-foreground">Lease period</p>
                <p className="font-medium">
                  {format(parseISO(lease.start_date), 'MMM d, yyyy')}
                  {lease.end_date
                    ? ` – ${format(parseISO(lease.end_date), 'MMM d, yyyy')}`
                    : ' (ongoing)'}
                </p>
              </div>
            )}
          </div>

          {/* Interest section */}
          {interestRatePct > 0 && (
            <div className="mt-2 rounded-lg border bg-muted/20 p-3 text-sm">
              <p className="font-medium text-muted-foreground text-xs mb-1">Interest</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Annual rate</p>
                  <p className="font-medium">{interestRatePct}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Accrued (on record)</p>
                  <p className="font-medium">
                    {formatCents(deposit.interest_accrued_cents, { withCents: true })}
                  </p>
                </div>
                {pendingInterestCents > 0 && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">
                      Pending since last calc
                      {deposit.last_interest_calc
                        ? ` (${format(parseISO(deposit.last_interest_calc), 'MMM d, yyyy')})`
                        : ''}
                    </p>
                    <p className="font-medium">
                      +{formatCents(pendingInterestCents, { withCents: true })}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Deduction items */}
          {deductionItems.length > 0 && (
            <div className="mt-2 rounded-lg border bg-muted/20 p-3 text-sm">
              <p className="font-medium text-muted-foreground text-xs mb-2">Deductions</p>
              <div className="space-y-1">
                {deductionItems.map((d, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm">{d.label}</span>
                    <span className="text-sm font-medium">
                      {formatCents(d.amount_cents, { withCents: true })}
                    </span>
                  </div>
                ))}
                <div className="mt-1 border-t pt-1 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Total deductions</span>
                  <span className="text-sm font-semibold">
                    {formatCents(totalDeductions, { withCents: true })}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Return info */}
          {deposit.returned_date && (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Returned date</p>
                <p className="font-medium">
                  {format(parseISO(deposit.returned_date), 'MMM d, yyyy')}
                </p>
              </div>
              {deposit.returned_amount_cents != null && (
                <div>
                  <p className="text-xs text-muted-foreground">Amount returned</p>
                  <p className="font-medium">
                    {formatCents(deposit.returned_amount_cents, { withCents: true })}
                  </p>
                </div>
              )}
            </div>
          )}

          {deposit.notes && (
            <div>
              <p className="text-xs text-muted-foreground">Notes</p>
              <p className="text-sm">{deposit.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Update form */}
      <Card>
        <CardHeader>
          <CardTitle>Update deposit</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <UpdateDepositForm
            depositId={deposit.id}
            initialStatus={deposit.status as DepositStatus}
            initialReturnedDate={deposit.returned_date ?? null}
            initialReturnedAmountCents={deposit.returned_amount_cents ?? null}
            initialHoldingInstitution={deposit.holding_institution ?? null}
            initialNotes={deposit.notes ?? null}
            initialDeductionItems={deductionItems}
          />
        </CardContent>
      </Card>
    </div>
  );
}
