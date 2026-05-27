'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export interface ReminderInput {
  days_before: number;
  notify_landlord: boolean;
  notify_tenant: boolean;
}

export interface CreateMaintenanceEventInput {
  appliance_id: string;
  property_id: string;
  title: string;
  scheduled_date: string;
  scheduled_time: string | null;
  scheduled_time_end: string | null;
  notes: string | null;
  reminders: ReminderInput[];
}

export async function createMaintenanceEvent(
  input: CreateMaintenanceEventInput,
): Promise<{ id?: string; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  if (!input.title.trim()) return { error: 'Title is required' };
  if (!input.scheduled_date) return { error: 'Date is required' };

  const { data: event, error: eventErr } = await supabase
    .from('maintenance_events')
    .insert({
      appliance_id: input.appliance_id,
      property_id: input.property_id,
      title: input.title.trim(),
      scheduled_date: input.scheduled_date,
      scheduled_time: input.scheduled_time || null,
      scheduled_time_end: input.scheduled_time_end || null,
      notes: input.notes?.trim() || null,
    })
    .select('id')
    .single();

  if (eventErr || !event) return { error: eventErr?.message ?? 'Failed to create event' };

  if (input.reminders.length > 0) {
    const validReminders = input.reminders.filter(
      (r) => r.notify_landlord || r.notify_tenant,
    );
    if (validReminders.length > 0) {
      const { error: remErr } = await supabase.from('maintenance_reminders').insert(
        validReminders.map((r) => ({
          event_id: event.id,
          days_before: Math.max(0, Math.round(r.days_before)),
          notify_landlord: r.notify_landlord,
          notify_tenant: r.notify_tenant,
        })),
      );
      if (remErr) {
        // Clean up orphaned event — best-effort
        await supabase.from('maintenance_events').delete().eq('id', event.id);
        return { error: remErr.message };
      }
    }
  }

  revalidatePath(`/landlord/properties/${input.property_id}/appliances/${input.appliance_id}`);
  return { id: event.id };
}
