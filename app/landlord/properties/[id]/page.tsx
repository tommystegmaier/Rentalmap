import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { formatCents } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { RemoveLateFeeButton } from '@/app/landlord/late-fees/remove-button';
import { RemoveTenantButton } from './remove-tenant-button';
import {
  FileText,
  FileSignature,
  Plus,
  Pencil,
  ChevronRight,
  Image as ImageIcon,
  Landmark,
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  TrendingUp,
  Calculator,
} from 'lucide-react';
import { MarketRentWidget } from '@/components/market-rent-widget';

type DepositStatus =
  | 'holding'
  | 'returned'
  | 'partially_returned'
  | 'applied_to_damages'
  | 'forfeited';

const DEPOSIT_BADGE: Record<DepositStatus, string> = {
  holding: 'border-blue-300 bg-blue-50 text-blue-700',
  returned: 'border-green-300 bg-green-50 text-green-700',
  partially_returned: 'border-yellow-300 bg-yellow-50 text-yellow-700',
  applied_to_damages: 'border-red-300 bg-red-50 text-red-700',
  forfeited: 'border-red-300 bg-red-50 text-red-700',
};
const DEPOSIT_LABEL: Record<DepositStatus, string> = {
  holding: 'Holding',
  returned: 'Returned',
  partially_returned: 'Partial return',
  applied_to_damages: 'Applied to damages',
  forfeited: 'Forfeited',
};

const INSP_BADGE: Record<string, string> = {
  move_in: 'border-transparent bg-blue-100 text-blue-700',
  move_out: 'border-transparent bg-orange-100 text-orange-700',
  periodic: 'border-transparent bg-muted text-muted-foreground',
};
const INSP_LABEL: Record<string, string> = {
  move_in: 'Move-in',
  move_out: 'Move-out',
  periodic: 'Periodic',
};

export default async function PropertyDetail({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: property } = await supabase
    .from('properties')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (!property) notFound();

  const yearStart = `${new Date().getFullYear()}-01-01`;
  const today = format(new Date(), 'yyyy-MM-dd');

  const [
    { data: leases },
    { data: appliances },
    { data: documents },
    { data: recentExpenses },
    { data: ytdExpenses },
    { data: propertyInspections },
    { data: upcomingMaintenanceEvents },
  ] = await Promise.all([
    supabase
      .from('leases')
      .select('*, lease_tenants(id, user_id, users:user_id(name, email, password_set))')
      .eq('property_id', params.id)
      .order('start_date', { ascending: false }),
    supabase.from('appliances').select('*').eq('property_id', params.id),
    supabase
      .from('documents')
      .select('*')
      .eq('property_id', params.id)
      .order('date_added', { ascending: false }),
    supabase
      .from('expenses')
      .select('id, date, amount_cents, category, vendor')
      .eq('property_id', params.id)
      .order('date', { ascending: false })
      .limit(5),
    supabase
      .from('expenses')
      .select('amount_cents')
      .eq('property_id', params.id)
      .gte('date', yearStart),
    supabase
      .from('inspections')
      .select('id, type, conducted_date, tenant_signed_at')
      .eq('property_id', params.id)
      .order('conducted_date', { ascending: false })
      .limit(10),
    supabase
      .from('maintenance_events')
      .select('id, appliance_id, title, scheduled_date')
      .eq('property_id', params.id)
      .is('completed_at', null)
      .gte('scheduled_date', today)
      .order('scheduled_date', { ascending: true }),
  ]);

  const [{ data: maintCountRaw }, { count: closedWorkOrderCount }] = await Promise.all([
    supabase
      .from('maintenance_events')
      .select('id, scheduled_date, completed_at')
      .eq('property_id', params.id),
    supabase
      .from('work_orders')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', params.id)
      .eq('status', 'closed'),
  ]);

  const pastMaintenanceCount = (maintCountRaw ?? []).filter(
    (e: { scheduled_date: string; completed_at: string | null }) =>
      !!e.completed_at || e.scheduled_date < today,
  ).length;

  const previousActivityCount = pastMaintenanceCount + (closedWorkOrderCount ?? 0);

  const ytdExpenseCents = (ytdExpenses ?? []).reduce(
    (s: number, e: { amount_cents: number | null }) => s + (e.amount_cents ?? 0),
    0,
  );

  // Build a map of appliance_id → next upcoming maintenance event (first result per appliance)
  type NextEventRow = { id: string; title: string; scheduled_date: string };
  const nextEventByAppliance = new Map<string, NextEventRow>();
  for (const ev of (upcomingMaintenanceEvents ?? []) as (NextEventRow & { appliance_id: string })[]) {
    if (!nextEventByAppliance.has(ev.appliance_id)) {
      nextEventByAppliance.set(ev.appliance_id, { id: ev.id, title: ev.title, scheduled_date: ev.scheduled_date });
    }
  }

  type LeaseTenantJoined = {
    id: string;
    user_id: string;
    users:
      | { name: string | null; email: string; password_set: boolean }
      | { name: string | null; email: string; password_set: boolean }[]
      | null;
  };

  const activeLease = leases?.find((l: { status: string }) => l.status === 'active') as
    | (Record<string, unknown> & {
        id: string;
        start_date: string;
        end_date: string;
        monthly_rent_cents: number;
        due_day: number;
        late_after_day: number;
        late_fee_cents: number;
        security_deposit_cents: number;
        terms_notes: string | null;
        lease_tenants: LeaseTenantJoined[];
      })
    | undefined;

  // Fetch security deposit and late fees only once we have the active lease id.
  type DepositRow = {
    id: string;
    amount_cents: number;
    status: DepositStatus;
    received_date: string | null;
    holding_institution: string | null;
    interest_rate_pct: number | null;
    interest_accrued_cents: number;
  };
  type LateFeeRow = {
    id: string;
    charge_date: string;
    amount_cents: number;
    period_start: string;
    waived: boolean;
    waive_note: string | null;
  };

  let securityDeposit: DepositRow | null = null;
  let lateFeeCharges: LateFeeRow[] = [];

  if (activeLease) {
    const [{ data: deposit }, { data: fees }] = await Promise.all([
      supabase
        .from('security_deposits')
        .select('id, amount_cents, status, received_date, holding_institution, interest_rate_pct, interest_accrued_cents')
        .eq('lease_id', activeLease.id)
        .maybeSingle(),
      supabase
        .from('late_fee_charges')
        .select('id, charge_date, amount_cents, period_start, waived, waive_note')
        .eq('lease_id', activeLease.id)
        .order('charge_date', { ascending: false })
        .limit(10),
    ]);
    securityDeposit = deposit as DepositRow | null;
    lateFeeCharges = (fees ?? []) as LateFeeRow[];
  }

  const inspections = (propertyInspections ?? []) as {
    id: string;
    type: string;
    conducted_date: string;
    tenant_signed_at: string | null;
  }[];

  const photoUrl = property.photo_url
    ? supabase.storage.from('property-photos').getPublicUrl(property.photo_url).data.publicUrl
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={property.address}
        description="Property details"
        action={
          <Button asChild size="sm" variant="outline">
            <Link href={`/landlord/properties/${params.id}/edit`}>
              <Pencil size={14} /> Edit
            </Link>
          </Button>
        }
      />

      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt={property.address}
          className="aspect-video w-full rounded-2xl border object-cover"
        />
      ) : (
        <Link
          href={`/landlord/properties/${params.id}/edit`}
          className="flex aspect-video w-full items-center justify-center gap-2 rounded-2xl border border-dashed text-sm text-muted-foreground hover:bg-muted/30"
        >
          <ImageIcon size={18} /> Add a property photo
        </Link>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Rent & purchase</span>
            <Button asChild size="sm" variant="outline">
              <Link href={`/landlord/properties/${params.id}/depreciation`}>
                <Calculator size={14} /> Depreciation
              </Link>
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <Field
            label="Asking rent"
            value={
              property.asking_rent_cents != null
                ? `${formatCents(property.asking_rent_cents)}/mo`
                : '—'
            }
          />
          <Field label="Purchase price" value={formatCents(property.purchase_price_cents)} />
          <Field
            label="Placed in service"
            value={property.placed_in_service ? format(parseISO(property.placed_in_service), 'PP') : '—'}
          />
          <Field label="Depreciable basis" value={formatCents(property.depreciable_basis_cents)} />
          <Field label="Annual depreciation" value={formatCents(property.annual_depreciation_cents)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp size={16} className="text-muted-foreground" />
            Market rent intelligence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MarketRentWidget
            propertyId={params.id}
            askingRentCents={property.asking_rent_cents ?? null}
            initialMarketRentCents={property.market_rent_cents ?? null}
            initialFetchedAt={property.market_rent_fetched_at ?? null}
          />
        </CardContent>
      </Card>

      {activeLease ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Current lease</span>
              <Button asChild size="sm" variant="outline">
                <Link href={`/landlord/properties/${params.id}/leases/${activeLease.id}`}>
                  <FileSignature size={14} /> View / Sign
                </Link>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Term"
                value={`${format(parseISO(activeLease.start_date), 'PP')} → ${format(parseISO(activeLease.end_date), 'PP')}`}
              />
              <Field label="Monthly rent" value={formatCents(activeLease.monthly_rent_cents)} />
              <Field label="Due day" value={`${activeLease.due_day} of month`} />
              <Field label="Late after" value={`Day ${activeLease.late_after_day}`} />
              <Field label="Late fee" value={formatCents(activeLease.late_fee_cents)} />
              <Field label="Security deposit" value={formatCents(activeLease.security_deposit_cents)} />
            </div>

            <div>
              <p className="text-muted-foreground">Tenants</p>
              <div className="mt-2 space-y-2">
                {activeLease.lease_tenants?.map((lt) => {
                  const u = Array.isArray(lt.users) ? lt.users[0] : lt.users;
                  const accepted = !!u?.password_set;
                  const displayName = u?.name ?? u?.email ?? '—';
                  return (
                    <div
                      key={lt.id}
                      className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${accepted ? 'bg-green-500' : 'bg-yellow-500'}`}
                        />
                        <span className="truncate text-sm font-medium">{displayName}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {accepted ? 'Active' : 'Invited'}
                        </span>
                      </div>
                      <RemoveTenantButton
                        leaseTenantId={lt.id}
                        propertyId={params.id}
                        tenantName={displayName}
                      />
                    </div>
                  );
                })}
                <Button asChild size="sm" variant="outline" className="w-full">
                  <Link href={`/landlord/invite?leaseId=${activeLease.id}`}>
                    <Plus size={12} /> Invite tenant
                  </Link>
                </Button>
              </div>
            </div>

            {activeLease.terms_notes ? (
              <div>
                <p className="text-muted-foreground">Terms</p>
                <p className="mt-1 whitespace-pre-wrap">{activeLease.terms_notes}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          icon={<FileSignature size={32} />}
          title="No active lease record yet"
          description="This is for the lease terms (dates, rent, late fees) — not the PDF. The PDF goes in the Documents section below. Without a lease record, you can't invite tenants or track rent."
          action={
            <Button asChild>
              <Link href={`/landlord/properties/${params.id}/leases/new`}>Create lease</Link>
            </Button>
          }
        />
      )}

      {/* Security deposit */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Landmark size={18} className="text-muted-foreground" />
              Security deposit
            </span>
            {!securityDeposit && activeLease ? (
              <Button asChild size="sm" variant="outline">
                <Link href={`/landlord/deposits/new?lease_id=${activeLease.id}&property_id=${params.id}`}>
                  <Plus size={14} /> Record
                </Link>
              </Button>
            ) : securityDeposit ? (
              <Button asChild size="sm" variant="outline">
                <Link href={`/landlord/deposits/${securityDeposit.id}`}>
                  <Pencil size={14} /> Manage
                </Link>
              </Button>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {securityDeposit ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Amount" value={formatCents(securityDeposit.amount_cents)} />
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge className={DEPOSIT_BADGE[securityDeposit.status] ?? ''}>
                    {DEPOSIT_LABEL[securityDeposit.status] ?? securityDeposit.status}
                  </Badge>
                </div>
                {securityDeposit.received_date ? (
                  <Field
                    label="Received"
                    value={format(parseISO(securityDeposit.received_date), 'PP')}
                  />
                ) : null}
                {securityDeposit.holding_institution ? (
                  <Field label="Held at" value={securityDeposit.holding_institution} />
                ) : null}
                {securityDeposit.interest_rate_pct != null ? (
                  <Field label="Interest rate" value={`${securityDeposit.interest_rate_pct}%`} />
                ) : null}
                {securityDeposit.interest_accrued_cents > 0 ? (
                  <Field label="Interest accrued" value={formatCents(securityDeposit.interest_accrued_cents)} />
                ) : null}
              </div>
            </div>
          ) : activeLease ? (
            <p className="text-muted-foreground">No deposit recorded for this lease yet.</p>
          ) : (
            <p className="text-muted-foreground">Create a lease to record a security deposit.</p>
          )}
        </CardContent>
      </Card>

      {/* Inspections */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ClipboardList size={18} className="text-muted-foreground" />
              Inspections
            </span>
            <Button asChild size="sm" variant="outline">
              <Link href={`/landlord/inspections/new?property_id=${params.id}`}>
                <Plus size={14} /> New
              </Link>
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {inspections.length > 0 ? (
            <div className="space-y-1">
              {inspections.map((insp) => (
                <Link
                  key={insp.id}
                  href={`/landlord/inspections/${insp.id}`}
                  className="flex items-center justify-between gap-2 border-b py-2.5 last:border-0 hover:bg-muted/30 -mx-1 px-1 rounded"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {INSP_LABEL[insp.type] ?? insp.type} inspection
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(insp.conducted_date), 'MMM d, yyyy')}
                      {insp.tenant_signed_at ? ' · Tenant signed' : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {insp.tenant_signed_at ? (
                      <CheckCircle2 size={14} className="text-green-600" />
                    ) : null}
                    <Badge className={INSP_BADGE[insp.type] ?? INSP_BADGE.periodic}>
                      {INSP_LABEL[insp.type] ?? insp.type}
                    </Badge>
                    <ChevronRight size={16} className="text-muted-foreground" />
                  </div>
                </Link>
              ))}
              <Link
                href={`/landlord/inspections`}
                className="block pt-2 text-center text-xs text-primary underline-offset-4 hover:underline"
              >
                View all inspections
              </Link>
            </div>
          ) : (
            <p className="text-muted-foreground">
              No inspections recorded. Document move-in and move-out condition with photos.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Late fees */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <AlertCircle size={18} className="text-muted-foreground" />
              Late fees
            </span>
            <Button asChild size="sm" variant="outline">
              <Link href="/landlord/late-fees">
                Manage all
              </Link>
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {lateFeeCharges.length > 0 ? (
            <div className="space-y-1">
              {lateFeeCharges.map((fee) => (
                <div key={fee.id} className="border-b py-2.5 last:border-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{formatCents(fee.amount_cents)}</p>
                      <p className="text-xs text-muted-foreground">
                        Period starting {format(parseISO(fee.period_start), 'MMM d, yyyy')}
                        {fee.waived ? ` · Removed${fee.waive_note ? `: ${fee.waive_note}` : ''}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {fee.waived ? (
                        <Badge className="border-transparent bg-muted text-muted-foreground">
                          Removed
                        </Badge>
                      ) : (
                        <>
                          <Badge className="border-transparent bg-destructive/10 text-destructive">
                            Outstanding
                          </Badge>
                          <RemoveLateFeeButton id={fee.id} />
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : activeLease ? (
            <p className="text-muted-foreground">
              {(activeLease as Record<string, unknown>).late_fee_enabled
                ? 'No late fees charged yet.'
                : 'Auto late fees are disabled for this lease.'}
            </p>
          ) : (
            <p className="text-muted-foreground">No active lease.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Expenses</span>
            <Button asChild size="sm" variant="outline">
              <Link
                href={`/landlord/expenses/new?property_id=${params.id}`}
              >
                <Plus size={14} /> Add
              </Link>
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-baseline justify-between border-b pb-3">
            <span className="text-muted-foreground">YTD spend</span>
            <span className="text-base font-semibold">
              {formatCents(ytdExpenseCents)}
            </span>
          </div>
          {recentExpenses && recentExpenses.length > 0 ? (
            <>
              {(recentExpenses as Array<{
                id: string;
                date: string;
                amount_cents: number;
                category: string;
                vendor: string | null;
              }>).map((e) => (
                <Link
                  key={e.id}
                  href={`/landlord/expenses/${e.id}`}
                  className="flex items-center justify-between gap-2 border-b py-2 last:border-0 hover:bg-muted/30"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{e.vendor ?? e.category}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.category} · {format(parseISO(e.date), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold">
                    {formatCents(e.amount_cents)}
                  </p>
                </Link>
              ))}
              <Link
                href={`/landlord/expenses?property_id=${params.id}`}
                className="block pt-1 text-center text-xs text-primary underline-offset-4 hover:underline"
              >
                View all expenses for this property
              </Link>
            </>
          ) : (
            <p className="text-muted-foreground">No expenses logged for this property yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Documents</span>
            <Button asChild size="sm" variant="outline">
              <Link href={`/landlord/properties/${params.id}/documents/new`}>
                <Plus size={14} /> Upload
              </Link>
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {documents && documents.length > 0 ? (
            documents.map((d: {
              id: string;
              filename: string;
              type: string;
              visible_to_tenant: boolean;
              date_added: string;
            }) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-2 border-b py-2 last:border-0"
              >
                <div className="min-w-0">
                  <a
                    href={`/api/documents/${d.id}/download`}
                    className="block truncate font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {d.filename}
                  </a>
                  <p className="text-xs text-muted-foreground">
                    {d.type} · added {format(parseISO(d.date_added), 'PP')}
                  </p>
                </div>
                <Badge
                  className={
                    d.visible_to_tenant
                      ? 'border-transparent bg-success/10 text-success'
                      : 'border-transparent bg-muted text-muted-foreground'
                  }
                >
                  {d.visible_to_tenant ? 'Shared' : 'Landlord only'}
                </Badge>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">
              <FileText size={16} className="mr-1 inline" />
              Nothing here yet. Upload the signed lease, insurance, or addendums.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Appliance registry</span>
            <Button asChild size="sm" variant="outline">
              <Link href={`/landlord/properties/${params.id}/appliances/new`}>
                <Plus size={14} /> Add
              </Link>
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {appliances && appliances.length > 0 ? (
            appliances.map((a: { id: string; name: string; next_service_due: string | null }) => {
              const nextEv = nextEventByAppliance.get(a.id);
              return (
              <Link
                key={a.id}
                href={`/landlord/properties/${params.id}/appliances/${a.id}`}
                className="flex items-center justify-between gap-2 border-b py-3 last:border-0 hover:bg-muted/30 tap-44"
              >
                <div className="min-w-0">
                  <p className="font-medium">{a.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {nextEv
                      ? `Next: ${nextEv.title} · ${format(parseISO(nextEv.scheduled_date), 'MMM d, yyyy')}`
                      : 'Tap to schedule maintenance'}
                  </p>
                </div>
                <ChevronRight size={18} className="shrink-0 text-muted-foreground" />
              </Link>
            );})
          ) : (
            <p className="text-muted-foreground">No appliances tracked yet.</p>
          )}
        </CardContent>
      </Card>

      {previousActivityCount > 0 ? (
        <Link href={`/landlord/properties/${params.id}/history`}>
          <Card className="transition hover:bg-muted/30">
            <CardContent className="flex items-center gap-3 p-3">
              <FolderOpen size={18} className="shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Previous service & work orders</p>
                <p className="text-xs text-muted-foreground">{previousActivityCount} completed</p>
              </div>
              <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      ) : null}
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
