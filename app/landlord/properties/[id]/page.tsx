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
import { FileText, FileSignature, Plus, Pencil, ChevronRight, Image as ImageIcon, X } from 'lucide-react';
import { removeTenantFromLease } from './tenants/actions';

export default async function PropertyDetail({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: property } = await supabase
    .from('properties')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (!property) notFound();

  const yearStart = `${new Date().getFullYear()}-01-01`;

  const [
    { data: leases },
    { data: appliances },
    { data: documents },
    { data: recentExpenses },
    { data: ytdExpenses },
  ] = await Promise.all([
    supabase
      .from('leases')
      .select('*, lease_tenants(id, user_id, users:user_id(name, email))')
      .eq('property_id', params.id)
      .order('start_date', { ascending: false }),
    supabase.from('appliances').select('*').eq('property_id', params.id),
    supabase
      .from('documents')
      .select('*')
      .eq('property_id', params.id)
      .order('date_added', { ascending: false }),
    supabase
      .from('expenses')
      .select('id, date, amount_cents, category, vendor')
      .eq('property_id', params.id)
      .order('date', { ascending: false })
      .limit(5),
    supabase
      .from('expenses')
      .select('amount_cents')
      .eq('property_id', params.id)
      .gte('date', yearStart),
  ]);

  const ytdExpenseCents = (ytdExpenses ?? []).reduce(
    (s: number, e: { amount_cents: number | null }) => s + (e.amount_cents ?? 0),
    0,
  );

  type LeaseTenantJoined = {
    id: string;
    user_id: string;
    users:
      | { name: string | null; email: string }
      | { name: string | null; email: string }[]
      | null;
  };

  async function removeTenant(formData: FormData) {
    'use server';
    await removeTenantFromLease(params.id, formData);
  }
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
                      <span
                        key={lt.id}
                        className="inline-flex items-center gap-1 rounded-full border bg-secondary px-2.5 py-0.5 text-xs font-medium"
                      >
                        {u?.name ?? u?.email ?? '—'}
                        <form action={removeTenant} className="inline">
                          <input type="hidden" name="lease_tenant_id" value={lt.id} />
                          <button
                            type="submit"
                            aria-label={`Remove ${u?.name ?? u?.email ?? 'tenant'}`}
                            className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            <X size={10} />
                          </button>
                        </form>
                      </span>
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
          title="No active lease record yet"
          description="This is for the lease terms (dates, rent, late fees) — not the PDF. The PDF goes in the Documents section below. Without a lease record, you can't invite tenants or track rent."
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
            <span>Expenses</span>
            <Button asChild size="sm" variant="outline">
              <Link
                href={`/landlord/expenses/new?property_id=${params.id}`}
              >
                <Plus size={14} /> Add
              </Link>
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-baseline justify-between border-b pb-3">
            <span className="text-muted-foreground">YTD spend</span>
            <span className="text-base font-semibold">
              {formatCents(ytdExpenseCents)}
            </span>
          </div>
          {recentExpenses && recentExpenses.length > 0 ? (
            <>
              {(recentExpenses as Array<{
                id: string;
                date: string;
                amount_cents: number;
                category: string;
                vendor: string | null;
              }>).map((e) => (
                <Link
                  key={e.id}
                  href={`/landlord/expenses/${e.id}`}
                  className="flex items-center justify-between gap-2 border-b py-2 last:border-0 hover:bg-muted/30"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{e.vendor ?? e.category}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.category} · {format(parseISO(e.date), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold">
                    {formatCents(e.amount_cents)}
                  </p>
                </Link>
              ))}
              <Link
                href={`/landlord/expenses?property_id=${params.id}`}
                className="block pt-1 text-center text-xs text-primary underline-offset-4 hover:underline"
              >
                View all expenses for this property
              </Link>
            </>
          ) : (
            <p className="text-muted-foreground">No expenses logged for this property yet.</p>
          )}
        </CardContent>
      </Card>

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
