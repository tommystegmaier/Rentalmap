'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { sendPushToUser } from '@/lib/push';

export interface MessageRow {
  id: string;
  sender_id: string;
  recipient_id: string;
  lease_id: string | null;
  body: string;
  read_at: string | null;
  created_at: string;
}

export async function sendMessage(input: {
  recipient_id: string;
  body: string;
  lease_id?: string | null;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const body = input.body.trim();
  if (!body) throw new Error('Message body is required');
  if (body.length > 5000) throw new Error('Message too long');
  if (!input.recipient_id) throw new Error('Recipient is required');
  if (input.recipient_id === user.id) throw new Error("You can't message yourself");

  const { data: msg, error } = await supabase
    .from('messages')
    .insert({
      sender_id: user.id,
      recipient_id: input.recipient_id,
      body,
      lease_id: input.lease_id ?? null,
    })
    .select('id')
    .single();
  if (error) throw error;

  // Look up recipient role to know which URL to deep-link
  const admin = createServiceRoleClient();
  const [{ data: recipient }, { data: sender }] = await Promise.all([
    admin.from('users').select('role').eq('id', input.recipient_id).maybeSingle(),
    admin.from('users').select('name, email').eq('id', user.id).maybeSingle(),
  ]);

  const url =
    recipient?.role === 'landlord'
      ? `/landlord/messages/${user.id}`
      : '/tenant/messages';
  const preview = body.length > 80 ? body.slice(0, 77) + '…' : body;
  const fromName = sender?.name ?? sender?.email ?? 'Someone';

  await sendPushToUser(input.recipient_id, {
    title: `New message from ${fromName}`,
    body: preview,
    url,
    tag: `msg-${msg.id}`,
  });

  revalidatePath('/landlord/messages');
  revalidatePath('/tenant/messages');
  return msg.id;
}

export async function markThreadRead(otherUserId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', user.id)
    .eq('sender_id', otherUserId)
    .is('read_at', null);
  // Bust home-page badge counts for both roles so the red dot clears immediately.
  revalidatePath('/tenant');
  revalidatePath('/landlord');
}
