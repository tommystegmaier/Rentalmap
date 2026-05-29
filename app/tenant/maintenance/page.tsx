import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { URGENCY_LABELS, type Urgency } from '@/lib/constants';
import { format, parseISO } from 'date-fns';
import { Wrench, FolderOpen, ChevronRight } from 'lucide-react';
import { MarkAllWorkOrderUpdatesRead } from './mark-read';

function woStatus(status: string) {
  const label = status === 'closed' ? 'Completed' : status.replace('_', ' ');
  const cls =
    status === 'closed'
      ? 'border-transparent bg-success/10 text-success'
      : 'border-transparent bg-destructive/10 text-destructive';
  return { label, cls };
}

export default async function TenantMaintenancePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: orders } = await supabase
    .from('work_orders')
    .select('*')
    .eq('submitted_by_user_id', user!.id)
    .order('submitted_at', { ascending: false });

  // Count past activity for the tenant's property to display on the folder card
  const { data: leaseLinks } = await supabase
    .from('lease_tenants')
    .select('leases:lease_id(property_id)')
    .eq('user_id', user!.id);
  const rawLease = leaseLinks?.[0]?.leases;
  const leaseRow = Array.isArray(rawLease) ? rawLease[0] : rawLease;
  const propertyId = (leaseRow as { property_id?: string } | null | undefined)?.property_id ?? null;

  let previousCount = 0;
  if (propertyId) {
    const today = format(new Date(), 'yyyy-MM-dd');
    const [{ data: maintCountRaw }, { count: closedWoCount }] = await Promise.all([
      supabase
        .from('maintenance_events')
        .select('id, scheduled_date, completed_at')
        .eq('property_id', propertyId),
      supabase
        .from('work_orders')
        .select('id', { count: 'exact', head: true })
        .eq('property_id', propertyId)
        .eq('status', 'closed'),
    ]);
    const pastMaint = (maintCountRaw ?? []).filter(
      (e: { scheduled_date: string; completed_at: string | null }) =>
        !!e.completed_at || e.scheduled_date < today,
    ).length;
    previousCount = pastMaint + (closedWoCount ?? 0);
  }

  const activeOrders = (orders ?? []).filter(
    (w: { status: string }) => w.status !== 'closed',
  );

  return (
    <div className="space-y-6">
      <MarkAllWorkOrderUpdatesRead />
      <PageHeader
        title="Work Orders"
        action={
          <Button asChild size="sm">
            <Link href="/tenant/maintenance/new">New</Link>
          </Button>
        }
      />

      {activeOrders.length > 0 ? (
        <div className="space-y-2">
          {activeOrders.map((w: {
            id: string;
            request_type: string;
            description: string;
            urgency: Urgency;
            status: 'open' | 'in_progress' | 'closed';
            submitted_at: string;
          }) => {
            const urg = URGENCY_LABELS[w.urgency];
            return (
              <Link key={w.id} href={`/tenant/maintenance/${w.id}`}>
                <Card className="transition hover:bg-muted/30">
                  <CardContent className="space-y-1 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{w.request_type}</p>
                      <Badge className={`border-transparent ${urg.color}`}>{urg.label}</Badge>
                    </div>
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {w.description}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{format(parseISO(w.submitted_at), 'MMM d')}</span>
                      {(() => {
                        const s = woStatus(w.status);
                        return <Badge className={s.cls}>{s.label}</Badge>;
                      })()}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (orders ?? []).length === 0 ? (
        <EmptyState
          icon={<Wrench size={32} />}
          title="No work orders yet"
          description="Submit a request and your landlord gets notified immediately."
          action={
            <Button asChild>
              <Link href="/tenant/maintenance/new">Submit request</Link>
            </Button>
          }
        />
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">No open work orders.</p>
      )}

      {previousCount > 0 ? (
        <Link href="/tenant/history">
          <Card className="transition hover:bg-muted/30">
            <CardContent className="flex items-center gap-3 p-3">
              <FolderOpen size={18} className="shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Previous service & work orders</p>
                <p className="text-xs text-muted-foreground">{previousCount} completed</p>
              </div>
              <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      ) : null}
    </div>
  );
}
