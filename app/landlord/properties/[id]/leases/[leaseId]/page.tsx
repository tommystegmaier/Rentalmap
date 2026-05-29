import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCents } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import {
  CheckCircle2,
  Clock,
  Download,
  FileSearch,
  PenLine,
} from 'lucide-react';
import { LandlordSignForm } from './sign-form';
import { LeaseAnalyzer } from './lease-analyzer';

export default async function LeaseDetailPage({
  params,
}: {
  params: { id: string; leaseId: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: leaseRaw } = await supabase
    .from('leases')
    .select(
      `id, start_date, end_date, monthly_rent_cents, due_day, late_after_day,
       late_fee_cents, security_deposit_cents, pets_allowed, utilities_paid_by,
       lawn_care_by, terms_notes, status, late_fee_enabled,
       landlord_signed_at, landlord_signed_name,
       tenant_signed_at, tenant_signed_name,
       properties:property_id(id, address, owner_id),
       lease_tenants(id, user_id, users:user_id(name, email))`,
    )
    .eq('id', params.leaseId)
    .eq('property_id', params.id)
    .maybeSingle();

  if (!leaseRaw) notFound();

  const prop = Array.isArray(leaseRaw.properties)
    ? leaseRaw.properties[0]
    : leaseRaw.properties;

  if ((prop as { owner_id: string } | null)?.owner_id !== user?.id) notFound();

  type LeaseRow = typeof leaseRaw & {
    landlord_signed_at: string | null;
    landlord_signed_name: string | null;
    tenant_signed_at: string | null;
    tenant_signed_name: string | null;
    lease_tenants: Array<{
      id: string;
      user_id: string;
      users: { name: string | null; email: string } | { name: string | null; email: string }[] | null;
    }>;
    late_fee_enabled: boolean;
  };
  const lease = leaseRaw as LeaseRow;
  const address = (prop as { address: string } | null)?.address ?? '—';

  const landlordSigned = !!lease.landlord_signed_at;
  const tenantSigned = !!lease.tenant_signed_at;
  const fullyExecuted = landlordSigned && tenantSigned;

  const pdfUrl = `/api/lease/${params.leaseId}/pdf`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lease agreement"
        description={address}
        action={
          <a href={pdfUrl} download>
            <Button size="sm" variant="outline">
              <Download size={14} />
              {fullyExecuted ? 'Download signed PDF' : 'Download PDF'}
            </Button>
          </a>
        }
      />

      {/* Signature status */}
      <div className="flex flex-wrap gap-2">
        <Badge
          className={
            landlordSigned
              ? 'border-transparent bg-green-100 text-green-700'
              : 'border-transparent bg-yellow-100 text-yellow-700'
          }
        >
          {landlordSigned ? (
            <>
              <CheckCircle2 size={12} className="mr-1" /> Landlord signed
            </>
          ) : (
            <>
              <Clock size={12} className="mr-1" /> Landlord unsigned
            </>
          )}
        </Badge>
        <Badge
          className={
            tenantSigned
              ? 'border-transparent bg-green-100 text-green-700'
              : 'border-transparent bg-muted text-muted-foreground'
          }
        >
          {tenantSigned ? (
            <>
              <CheckCircle2 size={12} className="mr-1" /> Tenant signed
            </>
          ) : (
            <>
              <Clock size={12} className="mr-1" /> Tenant unsigned
            </>
          )}
        </Badge>
        {fullyExecuted ? (
          <Badge className="border-transparent bg-green-100 text-green-700 font-medium">
            Fully executed
          </Badge>
        ) : null}
      </div>

      {/* Lease terms */}
      <Card>
        <CardHeader>
          <CardTitle>Lease terms</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <Field
            label="Term"
            value={`${format(parseISO(lease.start_date), 'PP')} – ${format(parseISO(lease.end_date), 'PP')}`}
          />
          <Field label="Monthly rent" value={`${formatCents(lease.monthly_rent_cents)}/mo`} />
          <Field label="Due day" value={`${lease.due_day} of month`} />
          <Field label="Late after" value={`Day ${lease.late_after_day}`} />
          <Field label="Late fee" value={formatCents(lease.late_fee_cents)} />
          <Field label="Security deposit" value={formatCents(lease.security_deposit_cents)} />
          <Field label="Pets" value={lease.pets_allowed ? 'Allowed' : 'Not allowed'} />
          <Field
            label="Utilities"
            value={capitalize(lease.utilities_paid_by as string ?? 'tenant')}
          />
          <Field
            label="Lawn care"
            value={capitalize(lease.lawn_care_by as string ?? 'tenant')}
          />
        </CardContent>
      </Card>

      {lease.terms_notes ? (
        <Card>
          <CardHeader>
            <CardTitle>Additional terms</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p className="whitespace-pre-wrap">{lease.terms_notes as string}</p>
          </CardContent>
        </Card>
      ) : null}

      {/* Signature details */}
      {(landlordSigned || tenantSigned) && (
        <Card>
          <CardHeader>
            <CardTitle>Signature log</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {landlordSigned && (
              <div className="flex items-start gap-2">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-green-600" />
                <div>
                  <p className="font-medium">
                    Landlord: {lease.landlord_signed_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Signed{' '}
                    {format(new Date(lease.landlord_signed_at!), 'PPpp')}
                  </p>
                </div>
              </div>
            )}
            {tenantSigned && (
              <div className="flex items-start gap-2">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-green-600" />
                <div>
                  <p className="font-medium">
                    Tenant: {lease.tenant_signed_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Signed{' '}
                    {format(new Date(lease.tenant_signed_at!), 'PPpp')}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Landlord sign form */}
      {!landlordSigned && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PenLine size={16} />
              Sign as landlord
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LandlordSignForm leaseId={params.leaseId} />
          </CardContent>
        </Card>
      )}

      {/* Tenant status hint */}
      {landlordSigned && !tenantSigned && (
        <Card className="border-dashed">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              <strong>Next step:</strong> Have your tenant sign from their portal at{' '}
              <strong>/tenant/lease</strong>. They&apos;ll see a &ldquo;Sign lease&rdquo; button
              once you have signed.
            </p>
          </CardContent>
        </Card>
      )}

      {/* AI Lease Analyzer */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSearch size={16} />
            AI lease analyzer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LeaseAnalyzer />
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href={`/landlord/properties/${params.id}`}>← Back to property</Link>
        </Button>
      </div>
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

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
