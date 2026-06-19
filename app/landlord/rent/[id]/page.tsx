import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BackButton } from '@/components/back-button';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { rentPeriodOptions } from '@/lib/rent-period';
import { one, formatCents } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { EditPaymentForm } from './form';

export default async function EditPaymentPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: payment } = await supabase
    .from('rent_payments')
    .select('*, leases:lease_id(id, due_day, properties:property_id(address))')
    .eq('id', params.id)
    .maybeSingle();

  if (!payment) notFound();

  const lease = one(payment.leases as
    | { id: string; due_day: number; properties: { address: string } | { address: string }[] | null }
    | { id: string; due_day: number; properties: { address: string } | { address: string }[] | null }[]
    | null);
  if (!lease) notFound();

  const addr = one(lease.properties as
    | { address: string }
    | { address: string }[]
    | null)?.address ?? '';

  // Fetch paid dates for this lease (excluding this payment so it doesn't
  // flag its own current period as already paid).
  const { data: paidDatesData } = await supabase
    .from('rent_payments')
    .select('expected_date')
    .eq('lease_id', lease.id)
    .in('status', ['settled', 'manual'])
    .neq('id', params.id);

  const paidExpectedDates = (paidDatesData ?? []).map(
    (p: { expected_date: string }) => p.expected_date,
  );

  // Use 18 months back so older payments can still be re-assigned.
  const periodOptions = rentPeriodOptions(lease.due_day, paidExpectedDates, 18, 12);

  // If the payment's current expected_date falls outside the generated range, prepend it.
  if (!periodOptions.find((o) => o.value === payment.expected_date)) {
    periodOptions.unshift({
      value: payment.expected_date,
      label: format(parseISO(payment.expected_date), 'MMMM yyyy'),
      paid: false,
    });
  }

  return (
    <div className="space-y-6">
      <BackButton fallback="/landlord/rent" label="Rent" />
      <PageHeader
        title="Edit payment"
        description={addr}
      />
      <Card>
        <CardContent className="pt-4 text-xs text-muted-foreground">
          Currently recorded as {formatCents(payment.amount_cents)} for{' '}
          {format(parseISO(payment.expected_date), 'MMMM yyyy')}
          {payment.received_date
            ? ` · received ${format(parseISO(payment.received_date), 'MMM d, yyyy')}`
            : ''}.
        </CardContent>
      </Card>
      <EditPaymentForm
        payment={{
          id: params.id,
          amount_cents: payment.amount_cents,
          expected_date: payment.expected_date,
          received_date: payment.received_date ?? null,
          method: payment.method ?? null,
          status: payment.status,
          notes: payment.notes ?? null,
        }}
        periodOptions={periodOptions}
      />
    </div>
  );
}
