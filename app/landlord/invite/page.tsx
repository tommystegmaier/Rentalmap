import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { format, parseISO } from 'date-fns';
import { one } from '@/lib/utils';
import { FileSignature, ChevronRight, Building2 } from 'lucide-react';
import { InviteForm } from './form';

interface LeaseRow {
  id: string;
  monthly_rent_cents: number;
  properties: { address: string } | { address: string }[] | null;
}
interface InviteRow {
  id: string;
  email: string;
  invited_at: string;
  status: 'pending' | 'accepted' | 'expired';
}

export default async function InvitePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: leases }, { data: invites }, { data: properties }] = await Promise.all([
    supabase
      .from('leases')
      .select('id, monthly_rent_cents, properties:property_id(address)')
      .eq('status', 'active'),
    supabase
      .from('tenant_invitations')
      .select('*')
      .order('invited_at', { ascending: false })
      .limit(20),
    supabase
      .from('properties')
      .select('id, address')
      .eq('owner_id', user!.id)
      .order('created_at'),
  ]);

  const hasActiveLeases = !!leases && leases.length > 0;
  const hasProperties = !!properties && properties.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invite tenant"
        description="Sends a magic-link signup tied to a specific lease"
      />

      {hasActiveLeases ? (
        <InviteForm
          leases={(leases as LeaseRow[]).map((l) => ({
            id: l.id,
            address: one(l.properties)?.address ?? '—',
            monthly_rent_cents: l.monthly_rent_cents,
          }))}
        />
      ) : hasProperties ? (
        <div className="space-y-3">
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="p-4 text-sm">
              <p className="font-medium">Create a lease record first</p>
              <p className="mt-1 text-muted-foreground">
                Tenants are invited to a specific lease. This needs the structured lease data
                (dates, rent, terms) — uploading the lease PDF alone isn&apos;t enough. Pick a
                property below to fill out the form, then come back to send the invite.
              </p>
            </CardContent>
          </Card>
          <ul className="space-y-2">
            {(properties as { id: string; address: string }[]).map((p) => (
              <li key={p.id}>
                <Link
                  href={`/landlord/properties/${p.id}/leases/new`}
                  className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-4 text-sm transition-colors hover:border-primary/40 tap-44"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <FileSignature size={16} className="text-primary" />
                    Create lease for {p.address}
                  </span>
                  <ChevronRight size={16} className="text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <EmptyState
          icon={<Building2 size={32} />}
          title="Add a property first"
          description="You need a property and an active lease before you can invite a tenant."
          action={
            <Button asChild>
              <Link href="/landlord/properties/new">Add property</Link>
            </Button>
          }
        />
      )}

      {invites && invites.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Recent invitations</h2>
          {(invites as InviteRow[]).map((inv) => (
            <Card key={inv.id}>
              <CardContent className="flex items-center justify-between p-3">
                <div>
                  <p className="text-sm font-medium">{inv.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Sent {format(parseISO(inv.invited_at), 'PP')}
                  </p>
                </div>
                <Badge
                  className={
                    inv.status === 'accepted'
                      ? 'bg-success/10 text-success border-transparent'
                      : inv.status === 'expired'
                        ? 'bg-destructive/10 text-destructive border-transparent'
                        : 'bg-warning/10 text-warning border-transparent'
                  }
                >
                  {inv.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </section>
      ) : null}
    </div>
  );
}
