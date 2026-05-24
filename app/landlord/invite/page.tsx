import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { one } from '@/lib/utils';
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

  const [{ data: leases }, { data: invites }] = await Promise.all([
    supabase
      .from('leases')
      .select('id, monthly_rent_cents, properties:property_id(address)')
      .eq('status', 'active'),
    supabase
      .from('tenant_invitations')
      .select('*')
      .order('invited_at', { ascending: false })
      .limit(20),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invite tenant"
        description="Sends a magic-link signup tied to a specific lease"
      />

      {leases && leases.length > 0 ? (
        <InviteForm
          leases={(leases as LeaseRow[]).map((l) => ({
            id: l.id,
            address: one(l.properties)?.address ?? '—',
            monthly_rent_cents: l.monthly_rent_cents,
          }))}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Create a lease first.{' '}
          <Link href="/landlord/properties" className="text-primary underline">
            Manage properties
          </Link>
        </p>
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
