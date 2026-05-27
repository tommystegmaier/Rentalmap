import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { format, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, CheckCircle2, Wrench, FolderOpen } from 'lucide-react';

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
      applianceId: string;
      completed: boolean;
    }
  | {
      kind: 'work_order';
      id: string;
      title: string;
      sortDate: string;
    };

export default async function PropertyHistoryPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const today = format(new Date(), 'yyyy-MM-dd');

  const [{ data: property }, { data: maintRaw }, { data: workOrdersRaw }] = await Promise.all([
    supabase.from('properties').select('id, address').eq('id', params.id).maybeSingle(),
    supabase
      .from('maintenance_events')
      .select('id, appliance_id, title, scheduled_date, completed_at, appliances:appliance_id(name)')
      .eq('property_id', params.id)
      .order('scheduled_date', { ascending: false }),
    supabase
      .from('work_orders')
      .select('id, request_type, submitted_at, closed_at')
      .eq('property_id', params.id)
      .eq('status', 'closed')
      .order('closed_at', { ascending: false, nullsFirst: false }),
  ]);

  if (!property) notFound();

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
        applianceId: ev.appliance_id,
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
      <PageHeader title="Previous service & work orders" description={property.address} />

      <Link
        href={`/landlord/properties/${params.id}`}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft size={16} />
        Back to property
      </Link>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            <FolderOpen size={28} className="mx-auto mb-2 opacity-40" />
            No previous service or work orders.
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
                    href={`/landlord/properties/${params.id}/appliances/${item.applianceId}/maintenance/${item.id}`}
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
                    ) : (
                      <ChevronRight size={18} className="shrink-0 text-muted-foreground" />
                    )}
                  </Link>
                );
              }
              return (
                <Link
                  key={`w-${item.id}`}
                  href={`/landlord/maintenance/${item.id}`}
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
