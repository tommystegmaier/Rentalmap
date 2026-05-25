import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ConversationView } from '@/components/conversation-view';
import { markThreadRead } from '@/lib/messages';
import { MessageSquare } from 'lucide-react';

export default async function TenantMessagesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: link } = await supabase
    .from('lease_tenants')
    .select(
      'lease_id, leases:lease_id(property_id, properties:property_id(owner_id, address))',
    )
    .eq('user_id', user.id)
    .maybeSingle();

  if (!link) {
    return (
      <div className="space-y-6">
        <PageHeader title="Messages" />
        <EmptyState
          icon={<MessageSquare size={32} />}
          title="No landlord linked yet"
          description="Once your landlord links you to a lease, you can message them here."
        />
      </div>
    );
  }

  const lease = Array.isArray(link.leases) ? link.leases[0] : link.leases;
  const prop = lease
    ? Array.isArray(lease.properties)
      ? lease.properties[0]
      : lease.properties
    : null;
  const landlordId = prop?.owner_id ?? null;
  if (!landlordId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Messages" />
        <EmptyState title="No landlord found" />
      </div>
    );
  }

  // Get landlord name via service role (tenants can't read landlord row by default).
  const admin = createServiceRoleClient();
  const { data: landlord } = await admin
    .from('users')
    .select('name, email')
    .eq('id', landlordId)
    .maybeSingle();

  const { data: messages } = await supabase
    .from('messages')
    .select('id, sender_id, body, created_at, read_at')
    .or(
      `and(sender_id.eq.${user.id},recipient_id.eq.${landlordId}),and(sender_id.eq.${landlordId},recipient_id.eq.${user.id})`,
    )
    .order('created_at', { ascending: true });

  await markThreadRead(landlordId);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Messages"
        description={`Chat with ${landlord?.name ?? landlord?.email ?? 'your landlord'}`}
      />
      <ConversationView
        currentUserId={user.id}
        otherUserId={landlordId}
        otherUserLabel={landlord?.name ?? 'landlord'}
        leaseId={link.lease_id}
        messages={(messages ?? []) as never}
      />
    </div>
  );
}
