import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { format, parseISO } from 'date-fns';
import { MessageSquare } from 'lucide-react';

interface TenantRow {
  user_id: string;
  users:
    | { id: string; name: string | null; email: string }
    | { id: string; name: string | null; email: string }[]
    | null;
  leases:
    | { id: string; properties: { owner_id: string } | { owner_id: string }[] | null }
    | { id: string; properties: { owner_id: string } | { owner_id: string }[] | null }[]
    | null;
}

interface MessageRow {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export default async function LandlordMessagesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Gather every tenant on any of my leases.
  const { data: tenantsRaw } = await supabase
    .from('lease_tenants')
    .select(
      'user_id, users:user_id(id, name, email), leases:lease_id(id, properties:property_id(owner_id))',
    );

  const myTenants = ((tenantsRaw ?? []) as TenantRow[]).filter((row) => {
    const lease = Array.isArray(row.leases) ? row.leases[0] : row.leases;
    const prop = lease
      ? Array.isArray(lease.properties)
        ? lease.properties[0]
        : lease.properties
      : null;
    return prop?.owner_id === user.id;
  });

  const uniqueTenants = new Map<string, { id: string; name: string | null; email: string }>();
  for (const t of myTenants) {
    const u = Array.isArray(t.users) ? t.users[0] : t.users;
    if (u) uniqueTenants.set(u.id, u);
  }

  // All messages involving me
  const { data: msgs } = await supabase
    .from('messages')
    .select('id, sender_id, recipient_id, body, read_at, created_at')
    .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order('created_at', { ascending: false });

  // Also include anyone I've talked to who isn't currently a tenant (past tenants etc.)
  for (const m of (msgs ?? []) as MessageRow[]) {
    const otherId = m.sender_id === user.id ? m.recipient_id : m.sender_id;
    if (!uniqueTenants.has(otherId)) {
      // We may not have access to their name without an extra fetch; show as "Unknown" for now.
      uniqueTenants.set(otherId, { id: otherId, name: null, email: 'past tenant' });
    }
  }

  // Compute last message + unread count per other-party.
  const summaries = Array.from(uniqueTenants.values()).map((t) => {
    const thread = ((msgs ?? []) as MessageRow[]).filter(
      (m) =>
        (m.sender_id === user.id && m.recipient_id === t.id) ||
        (m.sender_id === t.id && m.recipient_id === user.id),
    );
    const last = thread[0] ?? null;
    const unread = thread.filter(
      (m) => m.recipient_id === user.id && !m.read_at,
    ).length;
    return { tenant: t, last, unread };
  });

  summaries.sort((a, b) => {
    const at = a.last ? new Date(a.last.created_at).getTime() : 0;
    const bt = b.last ? new Date(b.last.created_at).getTime() : 0;
    return bt - at;
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Messages" />

      {summaries.length === 0 ? (
        <EmptyState
          icon={<MessageSquare size={32} />}
          title="No conversations yet"
          description="Invite a tenant to start messaging."
        />
      ) : (
        <ul className="space-y-2">
          {summaries.map(({ tenant, last, unread }) => (
            <li key={tenant.id}>
              <Link href={`/landlord/messages/${tenant.id}`}>
                <Card className="transition-colors hover:bg-muted/30">
                  <CardContent className="flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">
                          {tenant.name ?? tenant.email}
                        </p>
                        {unread > 0 ? (
                          <Badge className="border-transparent bg-primary text-primary-foreground">
                            {unread}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {last
                          ? `${last.sender_id === tenant.id ? '' : 'You: '}${last.body}`
                          : 'No messages yet'}
                      </p>
                    </div>
                    <p className="shrink-0 text-xs text-muted-foreground">
                      {last ? format(parseISO(last.created_at), 'MMM d') : ''}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
