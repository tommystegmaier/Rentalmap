import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { formatCents } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { FileText } from 'lucide-react';

export default async function LeasePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: leaseLinks } = await supabase
    .from('lease_tenants')
    .select('leases:lease_id(*, properties:property_id(address, id))')
    .eq('user_id', user!.id);

  const rawLease = leaseLinks?.[0]?.leases;
  const leaseRow = Array.isArray(rawLease) ? rawLease[0] : rawLease;
  const lease = leaseRow as
    | {
        monthly_rent_cents: number;
        due_day: number;
        late_after_day: number;
        late_fee_cents: number;
        security_deposit_cents: number;
        start_date: string;
        end_date: string;
        pets_allowed: boolean;
        terms_notes: string | null;
        properties:
          | { address: string; id: string }
          | { address: string; id: string }[]
          | null;
      }
    | null
    | undefined;

  if (!lease) {
    return (
      <div className="space-y-6">
        <PageHeader title="Lease" />
        <EmptyState title="No active lease" />
      </div>
    );
  }

  const prop = Array.isArray(lease.properties) ? lease.properties[0] : lease.properties;
  const { data: docs } = prop
    ? await supabase
        .from('documents')
        .select('*')
        .eq('visible_to_tenant', true)
        .eq('property_id', prop.id)
    : { data: [] as Array<{ id: string; filename: string; type: string }> };

  return (
    <div className="space-y-6">
      <PageHeader title="Lease summary" description={prop?.address ?? ''} />

      <Card>
        <CardHeader>
          <CardTitle>Term</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Start" value={format(parseISO(lease.start_date), 'PP')} />
          <Field label="End" value={format(parseISO(lease.end_date), 'PP')} />
          <Field label="Monthly rent" value={formatCents(lease.monthly_rent_cents)} />
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
