export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { formatCents } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { CheckCircle2, Clock, Download, FileText, PenLine } from 'lucide-react';
import { TenantSignForm } from './sign/form';

export default async function LeasePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: leaseLinks } = await supabase
    .from('lease_tenants')
    .select('leases:lease_id(*, properties:property_id(address, id, photo_url))')
    .eq('user_id', user!.id);

  const rawLease = leaseLinks?.[0]?.leases;
  const leaseRow = Array.isArray(rawLease) ? rawLease[0] : rawLease;
  const lease = leaseRow as
    | {
        id: string;
        monthly_rent_cents: number;
        due_day: number;
        late_after_day: number;
        late_fee_cents: number;
        security_deposit_cents: number;
        start_date: string;
        end_date: string;
        pets_allowed: boolean;
        terms_notes: string | null;
        landlord_signed_at: string | null;
        landlord_signed_name: string | null;
        tenant_signed_at: string | null;
        tenant_signed_name: string | null;
        properties:
          | { address: string; id: string; photo_url: string | null }
          | { address: string; id: string; photo_url: string | null }[]
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

  // Find the uploaded lease PDF (not the auto-generated signed copy).
  const uploadedLease = (docs ?? []).find(
    (d: { filename: string; type: string }) =>
      (d.type === 'Lease' || d.type === 'Lease addendum') &&
      d.filename !== 'Signed Lease Agreement.pdf',
  ) as { id: string; filename: string } | undefined;

  const photoUrl = prop?.photo_url
    ? supabase.storage.from('property-photos').getPublicUrl(prop.photo_url).data.publicUrl
    : null;

  const landlordSigned = !!lease.landlord_signed_at;
  const tenantSigned = !!lease.tenant_signed_at;
  const needsMySignature = landlordSigned && !tenantSigned;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lease summary"
        description={prop?.address ?? ''}
        action={
          <a href={`/api/lease/${lease.id}/pdf`} download>
            <Button size="sm" variant="outline">
              <Download size={14} />
              PDF
            </Button>
          </a>
        }
      />

      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt={prop?.address ?? 'Property'}
          className="aspect-video w-full rounded-2xl border object-cover"
        />
      ) : null}

      {/* Signature status */}
      <div className="flex flex-wrap gap-2">
        <Badge
          className={
            landlordSigned
              ? 'border-transparent bg-green-100 text-green-700'
              : 'border-transparent bg-muted text-muted-foreground'
          }
        >
          {landlordSigned ? (
            <>
              <CheckCircle2 size={12} className="mr-1" /> Landlord signed
            </>
          ) : (
            <>
              <Clock size={12} className="mr-1" /> Awaiting landlord
            </>
          )}
        </Badge>
        <Badge
          className={
            tenantSigned
              ? 'border-transparent bg-green-100 text-green-700'
              : 'border-transparent bg-yellow-100 text-yellow-700'
          }
        >
          {tenantSigned ? (
            <>
              <CheckCircle2 size={12} className="mr-1" /> You signed
            </>
          ) : (
            <>
              <Clock size={12} className="mr-1" /> Your signature needed
            </>
          )}
        </Badge>
      </div>

      {/* Signed copy download — shown once both parties have signed */}
      {tenantSigned && (
        <div className="flex items-center gap-3 rounded-xl border border-green-300 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/50">
          <CheckCircle2 className="shrink-0 text-green-600 dark:text-green-400" size={20} />
          <div className="flex-1">
            <p className="text-sm font-semibold text-green-800 dark:text-green-300">
              Lease fully executed
            </p>
            <p className="text-xs text-green-700 dark:text-green-500">
              Signed {format(new Date(lease.tenant_signed_at!), 'PP')}
            </p>
          </div>
          <a href={`/api/lease/${lease.id}/pdf`} download>
            <Button size="sm" variant="outline" className="gap-1.5 border-green-300 dark:border-green-700">
              <Download size={13} />
              Download PDF
            </Button>
          </a>
        </div>
      )}

      {/* Uploaded lease document — shown inline so tenant can read it before signing */}
      {uploadedLease && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText size={16} />
              Full lease document
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-0 pb-4 px-6">
            <p className="text-sm text-muted-foreground">
              Read the full lease before signing. Tap the button below to open it.
            </p>
            <a
              href={`/api/documents/${uploadedLease.id}/download?inline=true`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm" className="gap-1.5">
                <FileText size={13} />
                Open full lease
              </Button>
            </a>
          </CardContent>
        </Card>
      )}

      {/* Sign form — placed after the lease document so tenant reads first */}
      {needsMySignature && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PenLine size={16} />
              Sign this lease
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              Your landlord has signed.{uploadedLease ? ' Open the full lease above to review all terms, then' : ' Review the terms below, then'} add your signature to finalize this lease.
            </p>
            <TenantSignForm leaseId={lease.id} />
          </CardContent>
        </Card>
      )}

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
