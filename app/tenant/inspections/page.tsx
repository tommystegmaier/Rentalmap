import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
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
}

export default async function TenantInspectionsPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Find all leases this tenant is on
  const { data: leaseLinks } = await supabase
    .from('lease_tenants')
    .select('lease_id')
    .eq('user_id', user.id);

  const leaseIds = (leaseLinks ?? []).map((l) => l.lease_id);

  const { data: rows } =
    leaseIds.length > 0
      ? await supabase
          .from('inspections')
          .select('id, type, conducted_date, tenant_signed_at, properties:property_id(address)')
          .in('lease_id', leaseIds)
          .order('conducted_date', { ascending: false })
          .limit(200)
      : { data: [] };

  const inspections = (rows ?? []) as InspectionRow[];
  const needsSignature = inspections.filter((i) => !i.tenant_signed_at);
  const completed = inspections.filter((i) => !!i.tenant_signed_at);

  function InspectionCard({ insp, signed }: { insp: InspectionRow; signed: boolean }) {
    const prop = one(insp.properties);
    const addr = prop?.address ?? '—';
    return (
      <Link href={`/tenant/inspections/${insp.id}`}>
        <Card className={`transition hover:bg-muted/30 ${!signed ? 'border-yellow-400 dark:border-yellow-600' : ''}`}>
          <CardContent className="flex items-center gap-3 p-3">
            <span className={signed ? 'text-green-600' : 'text-yellow-500'}>
              {signed ? <CheckCircle2 size={18} /> : <ClipboardList size={18} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{addr}</p>
              <p className="truncate text-xs text-muted-foreground">
                {TYPE_LABEL[insp.type] ?? insp.type} · {format(parseISO(insp.conducted_date), 'MMM d, yyyy')}
              </p>
            </div>
            <Badge className={TYPE_BADGE[insp.type] ?? TYPE_BADGE.periodic}>
              {signed ? 'Signed' : 'Needs signature'}
            </Badge>
          </CardContent>
        </Card>
      </Link>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Inspections" />

      {inspections.length === 0 ? (
        <EmptyState
          icon={<ClipboardList size={32} />}
          title="No inspections yet"
          description="Your landlord will share inspections here for your review."
        />
      ) : (
        <>
          {needsSignature.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">Needs your signature</h2>
              {needsSignature.map((insp) => (
                <InspectionCard key={insp.id} insp={insp} signed={false} />
              ))}
            </section>
          )}
          {completed.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">Completed</h2>
              {completed.map((insp) => (
                <InspectionCard key={insp.id} insp={insp} signed={true} />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
