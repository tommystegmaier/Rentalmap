import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { formatCents } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { FileText, FileSignature, Plus, Pencil, ChevronRight, Image as ImageIcon } from 'lucide-react';

export default async function PropertyDetail({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: property } = await supabase
    .from('properties')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (!property) notFound();

  const [{ data: leases }, { data: appliances }, { data: documents }] = await Promise.all([
    supabase
      .from('leases')
      .select('*, lease_tenants(user_id, users:user_id(name, email))')
      .eq('property_id', params.id)
      .order('start_date', { ascending: false }),
    supabase.from('appliances').select('*').eq('property_id', params.id),
    supabase
      .from('documents')
      .select('*')
      .eq('property_id', params.id)
      .order('date_added', { ascending: false }),
  ]);

  type LeaseTenantJoined = {
    user_id: string;
    users:
      | { name: string | null; email: string }
      | { name: string | null; email: string }[]
      | null;
  };
  const activeLease = leases?.find((l: { status: string }) => l.status === 'active') as
    | (Record<string, unknown> & {
        start_date: string;
        end_date: string;
        monthly_rent_cents: number;
        due_day: number;
        late_after_day: number;
        late_fee_cents: number;
        security_deposit_cents: number;
        terms_notes: string | null;
        lease_tenants: LeaseTenantJoined[];
      })
    | undefined;

  const photoUrl = property.photo_url
    ? supabase.storage.from('property-photos').getPublicUrl(property.photo_url).data.publicUrl
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={property.address}
        description="Property details"
        action={
          <Button asChild size="sm" variant="outline">
            <Link href={`/landlord/properties/${params.id}/edit`}>
              <Pencil size={14} /> Edit
            </Link>
          </Button>
        }
      />

      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt={property.address}
          className="aspect-video w-full rounded-2xl border object-cover"
        />
      ) : (
        <Link
          href={`/landlord/properties/${params.id}/edit`}
          className="flex aspect-video w-full items-center justify-center gap-2 rounded-2xl border border-dashed text-sm text-muted-foreground hover:bg-muted/30"
        >
          <ImageIcon size={18} /> Add a property photo
        </Link>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Rent & purchase</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <Field
            label="Asking rent"
            value={
              property.asking_rent_cents != null
                ? `${formatCents(property.asking_rent_cents)}/mo`
                : '—'
            }
          />
          <Field label="Purchase price" value={formatCents(property.purchase_price_cents)} />
          <Field
            label="Placed in service"
            value={property.placed_in_service ? format(parseISO(property.placed_in_service), 'PP') : '—'}
          />
          <Field label="Depreciable basis" value={formatCents(property.depreciable_basis_cents)} />
          <Field label="Annual depreciation" value={formatCents(property.annual_depreciation_cents)} />
        </CardContent>
      </Card>

      {activeLease ? (
        <Card>
          <CardHeader>
            <CardTitle>Current lease</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Term"
                value={`${format(parseISO(activeLease.start_date), 'PP')} → ${format(parseISO(activeLease.end_date), 'PP')}`}
              />
              <Field label="Monthly rent" value={formatCents(activeLease.monthly_rent_cents)} />
              <Field label="Due day" value={`${activeLease.due_day} of month`} />
              <Field label="Late after" value={`Day ${activeLease.late_after_day}`} />
              <Field label="Late fee" value={formatCents(activeLease.late_fee_cents)} />
              <Field label="Security deposit" value={formatCents(activeLease.security_deposit_cents)} />
            </div>

            <div>
              <p className="text-muted-foreground">Tenants</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {activeLease.lease_tenants?.length ? (
                  activeLease.lease_tenants.map((lt) => {
                    const u = Array.isArray(lt.users) ? lt.users[0] : lt.users;
                    return (
                      <Badge key={lt.user_id} className="border-transparent bg-secondary">
                        {u?.name ?? u?.email ?? '—'}
                      </Badge>
                    );
                  })
                ) : (
                  <Button asChild size="sm" variant="outline">
                    <Link href="/landlord/invite">Invite tenant</Link>
                  </Button>
                )}
              </div>
            </div>

            {activeLease.terms_notes ? (
              <div>
                <p className="text-muted-foreground">Terms</p>
                <p className="mt-1 whitespace-pre-wrap">{activeLease.terms_notes}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          icon={<FileSignature size={32} />}
          title="No active lease"
          description="Create one to start tracking rent and inviting tenants."
          action={
            <Button asChild>
              <Link href={`/landlord/properties/${params.id}/leases/new`}>Create lease</Link>
            </Button>
          }
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Documents</span>
            <Button asChild size="sm" variant="outline">
              <Link href={`/landlord/properties/${params.id}/documents/new`}>
                <Plus size={14} /> Upload
              </Link>
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {documents && documents.length > 0 ? (
            documents.map((d: {
              id: string;
              filename: string;
              type: string;
              visible_to_tenant: boolean;
              date_added: string;
            }) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-2 border-b py-2 last:border-0"
              >
                <div className="min-w-0">
                  <a
                    href={`/api/documents/${d.id}/download`}
                    className="block truncate font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {d.filename}
                  </a>
                  <p className="text-xs text-muted-foreground">
                    {d.type} · added {format(parseISO(d.date_added), 'PP')}
                  </p>
                </div>
                <Badge
                  className={
                    d.visible_to_tenant
                      ? 'border-transparent bg-success/10 text-success'
                      : 'border-transparent bg-muted text-muted-foreground'
                  }
                >
                  {d.visible_to_tenant ? 'Shared' : 'Landlord only'}
                </Badge>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">
              <FileText size={16} className="mr-1 inline" />
              Nothing here yet. Upload the signed lease, insurance, or addendums.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Appliance registry</span>
            <Button asChild size="sm" variant="outline">
              <Link href={`/landlord/properties/${params.id}/appliances/new`}>
                <Plus size={14} /> Add
              </Link>
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {appliances && appliances.length > 0 ? (
            appliances.map((a: { id: string; name: string; next_service_due: string | null }) => (
              <Link
                key={a.id}
                href={`/landlord/properties/${params.id}/appliances/${a.id}`}
                className="flex items-center justify-between gap-2 border-b py-3 last:border-0 hover:bg-muted/30 tap-44"
              >
                <div className="min-w-0">
                  <p className="font-medium">{a.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.next_service_due
                      ? `Next service ${format(parseISO(a.next_service_due), 'PP')}`
                      : 'Tap to set service dates'}
                  </p>
                </div>
                <ChevronRight size={18} className="shrink-0 text-muted-foreground" />
              </Link>
            ))
          ) : (
            <p className="text-muted-foreground">No appliances tracked yet.</p>
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
