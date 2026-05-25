import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { URGENCY_LABELS, type Urgency } from '@/lib/constants';

interface WorkOrderListRow {
  id: string;
  request_type: string;
  description: string;
  urgency: Urgency;
  status: 'open' | 'in_progress' | 'closed';
  submitted_at: string;
  properties: { address: string } | { address: string }[] | null;
  submitter: { name: string | null; email: string } | { name: string | null; email: string }[] | null;
}
import { format, parseISO } from 'date-fns';
import { Wrench } from 'lucide-react';

export default async function MaintenancePage() {
  const supabase = createClient();
  const { data: orders } = await supabase
    .from('work_orders')
    .select('*, properties:property_id(address), submitter:submitted_by_user_id(name, email)')
    .order('submitted_at', { ascending: false })
    .limit(100);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Work orders"
        description="Inbox across all properties"
        action={
          <Button asChild size="sm">
            <Link href="/landlord/maintenance/new">Add</Link>
          </Button>
        }
      />

      {orders && orders.length > 0 ? (
        <div className="space-y-2">
          {(orders as WorkOrderListRow[]).map((w) => {
            const props = Array.isArray(w.properties) ? w.properties[0] : w.properties;
            const sub = Array.isArray(w.submitter) ? w.submitter[0] : w.submitter;
            const addr = props?.address ?? '—';
            const submitter = sub;
            const urg = URGENCY_LABELS[w.urgency];
            return (
              <Link key={w.id} href={`/landlord/maintenance/${w.id}`}>
                <Card className="transition hover:bg-muted/30">
                  <CardContent className="space-y-2 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{w.request_type}</p>
                      <Badge className={`border-transparent ${urg.color}`}>{urg.label}</Badge>
                    </div>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{w.description}</p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{addr}</span>
                      <span>
                        {format(parseISO(w.submitted_at), 'MMM d')} ·{' '}
                        {submitter?.name ?? submitter?.email ?? '—'} · {w.status.replace('_', ' ')}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Wrench size={32} />}
          title="No work orders yet"
          description="Tenants can submit from their portal, or log one yourself."
          action={
            <Button asChild>
              <Link href="/landlord/maintenance/new">Add work order</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
