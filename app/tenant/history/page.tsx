import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { format, parseISO } from 'date-fns';
import { ChevronLeft, CheckCircle2, Wrench, FolderOpen } from 'lucide-react';
import { BackButton } from '@/components/back-button';

type MaintenanceRow = {
  id: string;
  appliance_id: string;
  title: string;
  scheduled_date: string;
  completed_at: string | null;
  appliances: { name: string } | { name: string }[] | null;
};

type WorkOrderRow = {
  id: string;
  request_type: string;
  submitted_at: string;
  closed_at: string | null;
};

type PreviousItem =
  | {
      kind: 'maintenance';
      id: string;
      title: string;
      sortDate: string;
      applianceName: string | null;
      completed: boolean;
    }
  | {
      kind: 'work_order';
      id: string;
      title: string;
      sortDate: string;
    };

export default async function TenantHistoryPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Find the tenant's current property via lease_tenants.
  const { data: leaseLinks } = await supabase
    .from('lease_tenants')
    .select('leases:lease_id(property_id, properties:property_id(id, address))')
    .eq('user_id', user.id);

  const rawLease = leaseLinks?.[0]?.leases as unknown;
  const leaseRow = Array.isArray(rawLease) ? rawLease[0] : rawLease;
  const propsField = (leaseRow as { properties?: unknown } | null | undefined)?.properties;
  const propRaw = (Array.isArray(propsField) ? propsField[0] : propsField) as
    | { id: string; address: string }
    | null
    | undefined;

  if (!propRaw) {
    return (
      <div className="space-y-4">
        <PageHeader title="Previous service & work orders" />
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            <FolderOpen size={28} className="mx-auto mb-2 opacity-40" />
            No property associated with your account.
          </CardContent>
        </Card>
      </div>
    );
  }

  const propertyId = propRaw.id;
  const today = format(new Date(), 'yyyy-MM-dd');

  const [{ data: maintRaw }, { data: workOrdersRaw }] = await Promise.all([
    supabase
      .from('maintenance_events')
      .select('id, appliance_id, title, scheduled_date, completed_at, appliances:appliance_id(name)')
      .eq('property_id', propertyId)
      .order('scheduled_date', { ascending: false }),
    supabase
      .from('work_orders')
      .select('id, request_type, submitted_at, closed_at')
      .eq('property_id', propertyId)
      .eq('status', 'closed')
      .order('closed_at', { ascending: false, nullsFirst: false }),
  ]);

  const previousMaintenance = (maintRaw ?? []).filter(
    (e: { scheduled_date: string; completed_at: string | null }) =>
      !!e.completed_at || e.scheduled_date < today,
  );

  const items: PreviousItem[] = [
    ...(previousMaintenance as MaintenanceRow[]).map((ev): PreviousItem => {
      const appl = Array.isArray(ev.appliances) ? ev.appliances[0] : ev.appliances;
      return {
        kind: 'maintenance',
        id: ev.id,
        title: ev.title,
        sortDate: ev.completed_at ?? ev.scheduled_date,
        applianceName: appl?.name ?? null,
        completed: !!ev.completed_at,
      };
    }),
    ...((workOrdersRaw ?? []) as WorkOrderRow[]).map((wo): PreviousItem => ({
      kind: 'work_order',
      id: wo.id,
      title: wo.request_type,
      sortDate: wo.closed_at ?? wo.submitted_at,
    })),
  ].sort((a, b) => b.sortDate.localeCompare(a.sortDate));

  return (
    <div className="space-y-4">
      <PageHeader title="Previous service & work orders" description={propRaw.address} />

      <BackButton fallback="/tenant/maintenance" label="Back to work orders" />

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            <FolderOpen size={28} className="mx-auto mb-2 opacity-40" />
            No previous service or work orders yet.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-2 p-3 text-sm">
            {items.map((item) => {
              if (item.kind === 'maintenance') {
                return (
                  <Link
                    key={`m-${item.id}`}
                    href={`/tenant/history/maintenance/${item.id}`}
                    className="flex items-center justify-between gap-2 border-b py-3 last:border-0 hover:bg-muted/30 tap-44"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.applianceName ? `${item.applianceName} · ` : ''}
                        {format(parseISO(item.sortDate), 'MMM d, yyyy')}
                        {!item.completed ? ' · Past' : ''}
                      </p>
                    </div>
                    {item.completed ? (
                      <CheckCircle2 size={16} className="shrink-0 text-success" />
                    ) : null}
                  </Link>
                );
              }
              return (
                <Link
                  key={`w-${item.id}`}
                  href={`/tenant/maintenance/${item.id}`}
                  className="flex items-center justify-between gap-2 border-b py-3 last:border-0 hover:bg-muted/30 tap-44"
                >
                  <div className="min-w-0 flex items-center gap-2">
                    <Wrench size={14} className="shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Work order · Completed {format(parseISO(item.sortDate), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  <CheckCircle2 size={16} className="shrink-0 text-success" />
                </Link>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
