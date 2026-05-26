import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Users } from 'lucide-react';
import Link from 'next/link';

export default async function OwnersPage() {
  const supabase = createClient();

  const [{ data: properties }, { data: ownerLinks }, { data: invites }] = await Promise.all([
    supabase.from('properties').select('id, address').order('created_at'),
    supabase
      .from('property_owners')
      .select('id, property_id, ownership_pct, owner_user_id, users:owner_user_id(name, email)')
      .order('added_at'),
    supabase
      .from('owner_invitations')
      .select('id, property_id, email, ownership_pct, status, invited_at')
      .order('invited_at', { ascending: false }),
  ]);

  const propMap = Object.fromEntries((properties ?? []).map((p) => [p.id, p.address]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Property owners"
        description="Invite investors to see their property financials"
        action={
          <Button asChild size="sm">
            <Link href="/landlord/owners/invite">Invite owner</Link>
          </Button>
        }
      />

      {ownerLinks?.length === 0 && invites?.length === 0 ? (
        <EmptyState
          icon={<Users size={32} />}
          title="No property owners yet"
          description="Invite an investor or co-owner to give them read-only access to their property's financials."
          action={
            <Button asChild>
              <Link href="/landlord/owners/invite">Invite an owner</Link>
            </Button>
          }
        />
      ) : null}

      {(ownerLinks ?? []).length > 0 ? (
        <Card>
          <CardHeader><CardTitle>Active owners</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {(ownerLinks ?? []).map((link) => {
              const u = Array.isArray(link.users) ? link.users[0] : link.users as { name: string | null; email: string } | null;
              return (
                <div key={link.id} className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{u?.name ?? u?.email ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">
                      {propMap[link.property_id as string] ?? '—'} · {link.ownership_pct}% ownership
                    </p>
                  </div>
                  <Badge className="border-transparent bg-success/10 text-success">Active</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {(invites ?? []).filter((i) => i.status === 'pending').length > 0 ? (
        <Card>
          <CardHeader><CardTitle>Pending invitations</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {(invites ?? []).filter((i) => i.status === 'pending').map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{inv.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {propMap[inv.property_id as string] ?? '—'} · {inv.ownership_pct}% ownership
                  </p>
                </div>
                <Badge className="border-transparent bg-warning/10 text-warning">Pending</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
