import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { one } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { ClipboardList, CheckCircle2 } from 'lucide-react';

const TYPE_BADGE: Record<string, string> = {
  move_in: 'border-transparent bg-blue-100 text-blue-700',
  move_out: 'border-transparent bg-orange-100 text-orange-700',
  periodic: 'border-transparent bg-muted text-muted-foreground',
};

const TYPE_LABEL: Record<string, string> = {
  move_in: 'Move-in',
  move_out: 'Move-out',
  periodic: 'Periodic',
};

interface InspectionRow {
  id: string;
  type: string;
  conducted_date: string;
  tenant_signed_at: string | null;
  properties: { address: string } | { address: string }[] | null;
  leases: { start_date: string; end_date: string | null } | { start_date: string; end_date: string | null }[] | null;
}

export default async function InspectionsPage() {
  const supabase = createClient();

  const { data: rows } = await supabase
    .from('inspections')
    .select('id, type, conducted_date, tenant_signed_at, properties:property_id(address), leases:lease_id(start_date, end_date)')
    .order('conducted_date', { ascending: false })
    .limit(200);

  const inspections = (rows ?? []) as InspectionRow[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inspections"
        action={
          <Button asChild size="sm">
            <Link href="/landlord/inspections/new">New inspection</Link>
          </Button>
        }
      />

      {inspections.length > 0 ? (
        <div className="space-y-2">
          {inspections.map((insp) => {
            const prop = one(insp.properties);
            const addr = prop?.address ?? '—';
            return (
              <Link key={insp.id} href={`/landlord/inspections/${insp.id}`}>
                <Card className="transition hover:bg-muted/30">
                  <CardContent className="flex items-center justify-between gap-2 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{addr}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {format(parseISO(insp.conducted_date), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {insp.tenant_signed_at ? (
                        <CheckCircle2 size={16} className="text-green-600" />
                      ) : null}
                      <Badge className={TYPE_BADGE[insp.type] ?? TYPE_BADGE.periodic}>
                        {TYPE_LABEL[insp.type] ?? insp.type}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<ClipboardList size={32} />}
          title="No inspections yet"
          description="Document property condition at move-in and move-out."
          action={
            <Button asChild>
              <Link href="/landlord/inspections/new">New inspection</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
