import { notFound } from 'next/navigation';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { ConversationView } from '@/components/conversation-view';
import { markThreadRead } from '@/lib/messages';

export default async function LandlordThreadPage({
  params,
}: {
  params: { userId: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  // Look up the other user. We use service role because the landlord might message
  // a past tenant who isn't currently on any of their leases.
  const admin = createServiceRoleClient();
  const { data: other } = await admin
    .from('users')
    .select('id, name, email')
    .eq('id', params.userId)
    .maybeSingle();
  if (!other) notFound();

  // Find the lease that links them, if any
  const { data: link } = await supabase
    .from('lease_tenants')
    .select('lease_id, leases:lease_id(property_id, properties:property_id(owner_id))')
    .eq('user_id', other.id)
    .maybeSingle();

  let leaseId: string | null = null;
  if (link) {
    const lease = Array.isArray(link.leases) ? link.leases[0] : link.leases;
    const prop = lease
      ? Array.isArray(lease.properties)
        ? lease.properties[0]
        : lease.properties
      : null;
    if (prop?.owner_id === user.id) leaseId = link.lease_id;
  }

  const { data: messages } = await supabase
    .from('messages')
    .select('id, sender_id, body, created_at, read_at')
    .or(
      `and(sender_id.eq.${user.id},recipient_id.eq.${other.id}),and(sender_id.eq.${other.id},recipient_id.eq.${user.id})`,
    )
    .order('created_at', { ascending: true });

  await markThreadRead(other.id);

  return (
    <div className="space-y-4">
      <PageHeader title={other.name ?? other.email} description="Conversation" />
      <ConversationView
        currentUserId={user.id}
        otherUserId={other.id}
        otherUserLabel={other.name ?? other.email}
        leaseId={leaseId}
        messages={(messages ?? []) as never}
      />
    </div>
  );
}
