'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { syncRemindersForLandlord } from '@/lib/reminders-run';

export async function dismissReminder(formData: FormData) {
  const id = String(formData.get('id'));
  if (!id) return;
  const supabase = createClient();
  await supabase.from('reminders').update({ dismissed: true }).eq('id', id);
  revalidatePath('/landlord/reminders');
}

export async function syncMyReminders() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: settings } = await supabase
    .from('users')
    .select('id, role, tenant_rent_reminder_enabled, tenant_rent_reminder_days_before')
    .eq('id', user.id)
    .maybeSingle();

  if (!settings || settings.role !== 'landlord') {
    throw new Error('Only landlords can sync reminders');
  }

  // Service-role client so the action can write tenant_rent_due rows whose
  // user_id is the *tenant's* id (RLS would otherwise block that, since the
  // policy is user_id = auth.uid()).
  const admin = createServiceRoleClient();
  await syncRemindersForLandlord(admin, {
    id: settings.id,
    tenant_rent_reminder_enabled: settings.tenant_rent_reminder_enabled,
    tenant_rent_reminder_days_before: settings.tenant_rent_reminder_days_before,
  });

  revalidatePath('/landlord/reminders');
}
