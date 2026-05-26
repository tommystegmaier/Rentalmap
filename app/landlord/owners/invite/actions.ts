'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

export async function inviteOwner(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const property_id = String(formData.get('property_id'));
  const email = String(formData.get('email')).trim().toLowerCase();
  const ownership_pct = Number(formData.get('ownership_pct') ?? 100);

  if (!property_id || !email) throw new Error('Property and email are required');

  // Insert invitation record (manager_id scoped by RLS).
  const { data: invite, error } = await supabase
    .from('owner_invitations')
    .insert({ manager_id: user.id, property_id, email, ownership_pct })
    .select('token')
    .maybeSingle();
  if (error) throw error;

  // If this email already has an account with role='owner', link them immediately.
  const admin = createServiceRoleClient();
  const { data: existing } = await admin
    .from('users')
    .select('id, role')
    .eq('email', email)
    .maybeSingle();

  if (existing?.id) {
    // Upgrade to owner role if needed.
    if (existing.role !== 'owner') {
      await admin.from('users').update({ role: 'owner' }).eq('id', existing.id);
    }
    // Create the property_owners link.
    await admin.from('property_owners').upsert({
      property_id,
      owner_user_id: existing.id,
      ownership_pct,
    }, { onConflict: 'property_id,owner_user_id' });
    // Mark invite accepted.
    await admin
      .from('owner_invitations')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('token', invite?.token);
  }
  // TODO: send invite email with magic link using invite.token

  revalidatePath('/landlord/owners');
  redirect('/landlord/owners');
}
