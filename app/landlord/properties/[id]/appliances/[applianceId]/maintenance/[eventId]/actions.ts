'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { ReminderInput } from '../new/actions';

export interface UpdateMaintenanceEventInput {
  title: string;
  scheduled_date: string;
  scheduled_time: string | null;
  notes: string | null;
  reminders: ReminderInput[];
}

export async function updateMaintenanceEvent(
  eventId: string,
  propertyId: string,
  applianceId: string,
  input: UpdateMaintenanceEventInput,
): Promise<{ error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  if (!input.title.trim()) return { error: 'Title is required' };
  if (!input.scheduled_date) return { error: 'Date is required' };

  const badReminder = input.reminders.find((r) => !r.notify_landlord && !r.notify_tenant);
  if (badReminder !== undefined) return { error: 'Each reminder must notify at least one recipient' };

  const { error: updErr } = await supabase
    .from('maintenance_events')
    .update({
      title: input.title.trim(),
      scheduled_date: input.scheduled_date,
      scheduled_time: input.scheduled_time || null,
      notes: input.notes?.trim() || null,
    })
    .eq('id', eventId);
  if (updErr) return { error: updErr.message };

  // Replace all reminders (delete old, insert new).
  await supabase.from('maintenance_reminders').delete().eq('event_id', eventId);

  if (input.reminders.length > 0) {
    const validReminders = input.reminders.filter(
      (r) => r.notify_landlord || r.notify_tenant,
    );
    if (validReminders.length > 0) {
      const { error: remErr } = await supabase.from('maintenance_reminders').insert(
        validReminders.map((r) => ({
          event_id: eventId,
          days_before: Math.max(0, Math.round(r.days_before)),
          notify_landlord: r.notify_landlord,
          notify_tenant: r.notify_tenant,
        })),
      );
      if (remErr) return { error: remErr.message };
    }
  }

  revalidatePath(`/landlord/properties/${propertyId}/appliances/${applianceId}`);
  revalidatePath(`/landlord/properties/${propertyId}/appliances/${applianceId}/maintenance/${eventId}`);
  return {};
}

export async function completeMaintenanceEvent(
  eventId: string,
  propertyId: string,
  applianceId: string,
): Promise<{ error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { error } = await supabase
    .from('maintenance_events')
    .update({ completed_at: new Date().toISOString(), completed_by: user.id })
    .eq('id', eventId);
  if (error) return { error: error.message };

  revalidatePath(`/landlord/properties/${propertyId}/appliances/${applianceId}`);
  return {};
}

export async function deleteMaintenanceEvent(
  eventId: string,
  propertyId: string,
  applianceId: string,
): Promise<{ error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { error } = await supabase
    .from('maintenance_events')
    .delete()
    .eq('id', eventId);
  if (error) return { error: error.message };

  revalidatePath(`/landlord/properties/${propertyId}/appliances/${applianceId}`);
  return {};
}
