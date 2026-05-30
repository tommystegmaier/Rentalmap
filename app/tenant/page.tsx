export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { formatCents } from '@/lib/utils';
import { format, parseISO, differenceInCalendarDays, addMonths, setDate } from 'date-fns';
import { Home as HomeIcon, Wallet, Wrench, FileText, MessageSquare, ChevronRight, ClipboardList, CheckCircle2, PenLine } from 'lucide-react';
import { URGENCY_LABELS, type Urgency } from '@/lib/constants';

export default async function TenantDashboard() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: leaseLinks } = await supabase
    .from('lease_tenants')
    .select(
      'lease_id, leases:lease_id(*, properties:property_id(id, address, photo_url))',
    )
    .eq('user_id', user.id);

  const rawLease = leaseLinks?.[0]?.leases;
  const leaseRow = Array.isArray(rawLease) ? rawLease[0] : rawLease;
  const lease = leaseRow as
    | {
        id: string;
        monthly_rent_cents: number;
        due_day: number;
        start_date: string;
        end_date: string;
        late_after_day: number;
        late_fee_cents: number;
        security_deposit_cents: number;
        pets_allowed: boolean;
        terms_notes: string | null;
        landlord_signed_at: string | null;
        tenant_signed_at: string | null;
        properties:
          | { id: string; address: string; photo_url: string | null }
          | { id: string; address: string; photo_url: string | null }[]
          | null;
      }
    | null
    | undefined;

  const prop = lease
    ? Array.isArray(lease.properties)
      ? lease.properties[0]
      : lease.properties
    : null;

  if (!lease) {
    return (
      <div className="space-y-6">
        <PageHeader title="Welcome" />
        <EmptyState
          icon={<HomeIcon size={32} />}
          title="No lease yet"
          description="Your landlord will link your account to a lease after you sign in. If you got an invitation, please make sure you signed up with that email."
        />
      </div>
    );
  }

  const photoUrl = prop?.photo_url
    ? supabase.storage.from('property-photos').getPublicUrl(prop.photo_url).data.publicUrl
    : null;

  const leaseId = lease.id;

  const [
    { data: payments },
    { data: openWorkOrders },
    { data: docs },
    { count: unreadMessages },
    { count: unreadWoUpdates },
    { data: inspectionRows },
  ] = await Promise.all([
    supabase
      .from('rent_payments')
      .select('amount_cents, status, received_date, expected_date, method')
      .eq('lease_id', lease.id)
      .order('expected_date', { ascending: false })
      .limit(5),
    supabase
      .from('work_orders')
      .select('id, status, request_type, urgency, submitted_at')
      .eq('submitted_by_user_id', user.id)
      .neq('status', 'closed')
      .order('submitted_at', { ascending: false }),
    prop
      ? supabase
          .from('documents')
          .select('id, filename, type')
          .eq('property_id', prop.id)
          .order('date_added', { ascending: false })
      : Promise.resolve({ data: [] as Array<{ id: string; filename: string; type: string }> }),
    supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .is('read_at', null),
    // Maintenance badge: only unread landlord-driven status updates, not the
    // tenant's own open work orders.
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('type', ['work_order_in_progress', 'work_order_completed'])
      .is('read_at', null)
      .is('dismissed_at', null),
    supabase
      .from('inspections')
      .select('id, type, conducted_date, tenant_signed_at')
      .eq('lease_id', leaseId)
      .order('conducted_date', { ascending: false })
      .limit(10),
  ]);

  const today = new Date();
  let nextDue = setDate(today, lease.due_day);
  if (nextDue < today) nextDue = addMonths(nextDue, 1);
  const daysUntil = differenceInCalendarDays(nextDue, today);

  return (
    <div className="space-y-6">
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt={prop?.address ?? 'Property'}
          className="aspect-video w-full rounded-2xl border object-cover"
        />
      ) : null}

      <PageHeader title="Welcome home" description={prop?.address ?? ''} />

      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/tenant/messages"
          className="relative flex flex-col items-center gap-1 rounded-2xl border bg-card p-3 text-center text-xs hover:bg-muted/30 tap-44"
        >
          {(unreadMessages ?? 0) > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-background">
              {(unreadMessages ?? 0) > 99 ? '99+' : unreadMessages}
            </span>
          ) : null}
          <span className="text-primary" aria-hidden><MessageSquare size={20} /></span>
          <span className="font-medium">Messages</span>
        </Link>
        <Link
          href="/tenant/maintenance"
          className="relative flex flex-col items-center gap-1 rounded-2xl border bg-card p-3 text-center text-xs hover:bg-muted/30 tap-44"
        >
          {(unreadWoUpdates ?? 0) > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-background">
              {(unreadWoUpdates ?? 0) > 99 ? '99+' : unreadWoUpdates}
            </span>
          ) : null}
          <span className="text-primary" aria-hidden><Wrench size={20} /></span>
          <span className="font-medium">Maintenance</span>
        </Link>
      </div>

      {lease.landlord_signed_at && !lease.tenant_signed_at ? (
        <Card className="border-yellow-400 dark:border-yellow-600">
          <CardContent className="flex items-start gap-3 p-4">
            <PenLine size={22} className="mt-0.5 shrink-0 text-yellow-500" />
            <div className="flex-1">
              <p className="font-semibold">Action needed: Sign your lease</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Your landlord has signed. Review the terms and add your signature to make it official.
              </p>
              <Button asChild size="sm" className="mt-3">
                <Link href="/tenant/lease">Sign now</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {(inspectionRows as { id: string; type: string; conducted_date: string; tenant_signed_at: string | null }[] | null)
        ?.filter((i) => !i.tenant_signed_at)
        .map((insp) => {
          const TYPE_LABEL: Record<string, string> = { move_in: 'Move-in', move_out: 'Move-out', periodic: 'Periodic' };
          const label = TYPE_LABEL[insp.type] ?? insp.type;
          return (
            <Card key={insp.id} className="border-yellow-400 dark:border-yellow-600">
              <CardContent className="flex items-start gap-3 p-4">
                <PenLine size={22} className="mt-0.5 shrink-0 text-yellow-500" />
                <div className="flex-1">
                  <p className="font-semibold">Action needed: Sign {label.toLowerCase()} inspection</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Your landlord has completed this inspection. Review and sign to confirm it.
                  </p>
                  <Button asChild size="sm" className="mt-3">
                    <Link href={`/tenant/inspections/${insp.id}`}>Review &amp; sign</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

      <Card>
        <CardHeader>
          <CardTitle>Next rent due</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-baseline justify-between">
            <p className="text-2xl font-semibold">{formatCents(lease.monthly_rent_cents)}</p>
            <p className="text-sm text-muted-foreground">
              {format(nextDue, 'MMM d')} · {daysUntil} day{daysUntil === 1 ? '' : 's'}
            </p>
          </div>
          <Button asChild className="w-full">
            <Link href="/tenant/pay">
              <Wallet size={16} className="mr-2" />
              Pay rent
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lease details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <Field
            label="Term"
            value={`${format(parseISO(lease.start_date), 'PP')} → ${format(parseISO(lease.end_date), 'PP')}`}
          />
          <Field label="Due day" value={`${lease.due_day} of month`} />
          <Field label="Late after" value={`Day ${lease.late_after_day}`} />
          <Field label="Late fee" value={formatCents(lease.late_fee_cents)} />
          <Field label="Security deposit" value={formatCents(lease.security_deposit_cents)} />
          <Field label="Pets" value={lease.pets_allowed ? 'Allowed' : 'Not allowed'} />
        </CardContent>
      </Card>

      {lease.terms_notes ? (
        <Card>
          <CardHeader>
            <CardTitle>Terms</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p className="whitespace-pre-wrap">{lease.terms_notes}</p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {docs && docs.length > 0 ? (
            docs.map((d: { id: string; filename: string; type: string }) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-2 border-b py-2 last:border-0"
              >
                <a
                  href={`/api/documents/${d.id}/download`}
                  className="min-w-0 truncate text-primary underline-offset-4 hover:underline"
                >
                  {d.filename}
                </a>
                <Badge className="border-transparent bg-secondary">{d.type}</Badge>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">
              <FileText size={16} className="mr-1 inline" />
              No documents shared yet.
            </p>
          )}
        </CardContent>
      </Card>

      {(inspectionRows as { id: string; type: string; conducted_date: string; tenant_signed_at: string | null }[] | null)
        ?.filter((i) => !!i.tenant_signed_at).length ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">Completed inspections</h2>
            <Link href="/tenant/inspections" className="text-xs text-primary">
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {(inspectionRows as { id: string; type: string; conducted_date: string; tenant_signed_at: string | null }[])
              .filter((i) => !!i.tenant_signed_at)
              .map((insp) => {
                const TYPE_LABEL: Record<string, string> = { move_in: 'Move-in', move_out: 'Move-out', periodic: 'Periodic' };
                const label = TYPE_LABEL[insp.type] ?? insp.type;
                return (
                  <Link key={insp.id} href={`/tenant/inspections/${insp.id}`}>
                    <Card className="transition hover:bg-muted/30">
                      <CardContent className="flex items-center gap-3 p-3">
                        <CheckCircle2 size={18} className="shrink-0 text-green-600" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{label} inspection</p>
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(insp.conducted_date), 'MMM d, yyyy')} · Signed
                          </p>
                        </div>
                        <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">Recent payments</h2>
          <Link href="/tenant/payments" className="text-xs text-primary">
            View all
          </Link>
        </div>
        {payments && payments.length > 0 ? (
          <div className="space-y-2">
            {payments.map((p: {
              amount_cents: number;
              status: string;
              method: string | null;
              received_date: string | null;
              expected_date: string;
            }, i: number) => (
              <Card key={i}>
                <CardContent className="flex items-center justify-between p-3 text-sm">
                  <div>
                    <p className="font-medium">{formatCents(p.amount_cents)}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.received_date
                        ? `Received ${format(parseISO(p.received_date), 'MMM d')}`
                        : `Expected ${format(parseISO(p.expected_date), 'MMM d')}`}
                      {p.method ? ` · ${p.method}` : ''}
                    </p>
                  </div>
                  <Badge className="border-transparent bg-secondary">{p.status}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">Open work orders</h2>
          <Badge className="border-transparent bg-muted text-muted-foreground">
            {openWorkOrders?.length ?? 0}
          </Badge>
        </div>

        {openWorkOrders && openWorkOrders.length > 0 ? (
          <div className="space-y-2">
            {(openWorkOrders as {
              id: string;
              status: string;
              request_type: string;
              urgency: Urgency;
              submitted_at: string;
            }[]).map((w) => {
              const urg = URGENCY_LABELS[w.urgency];
              const statusLabel = w.status === 'in_progress' ? 'In progress' : 'Open';
              return (
                <Link key={w.id} href={`/tenant/maintenance/${w.id}`}>
                  <Card className="transition hover:bg-muted/30">
                    <CardContent className="flex items-center gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{w.request_type}</p>
                        <p className="text-xs text-muted-foreground">
                          {statusLabel} · submitted {format(parseISO(w.submitted_at), 'MMM d')}
                        </p>
                      </div>
                      {urg ? (
                        <Badge className={`shrink-0 border-transparent ${urg.color}`}>
                          {urg.label}
                        </Badge>
                      ) : null}
                      <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : null}

        <Button asChild variant="outline" className="w-full">
          <Link href="/tenant/maintenance/new">
            <Wrench size={16} className="mr-2" />
            Submit work order
          </Link>
        </Button>
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
