import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { URGENCY_LABELS, type Urgency } from '@/lib/constants';
import { format, parseISO } from 'date-fns';
import { Wrench } from 'lucide-react';

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Work orders"
        action={
          <Button asChild size="sm">
            <Link href="/tenant/maintenance/new">New</Link>
          </Button>
        }
      />

      {orders && orders.length > 0 ? (
        <div className="space-y-2">
          {orders.map((w: {
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
                      <span>{w.status.replace('_', ' ')}</span>
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
          description="Submit a request and your landlord gets notified immediately."
          action={
            <Button asChild>
              <Link href="/tenant/maintenance/new">Submit request</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
