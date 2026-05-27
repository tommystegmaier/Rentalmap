'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { addMonths, format, parseISO } from 'date-fns';
import { createClient } from '@/lib/supabase/server';

type ApplianceType = 'general' | 'hvac_filter' | 'sprinkler';

function nonEmpty(v: FormDataEntryValue | null): string | null {
  const s = (v as string | null)?.toString().trim();
  return s ? s : null;
}

function parseIntervalMonths(v: FormDataEntryValue | null): number | null {
  const s = (v as string | null)?.toString().trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 1 || n > 120) return null;
  return Math.round(n);
}

function parseType(v: FormDataEntryValue | null): ApplianceType {
  const s = (v as string | null)?.toString();
  if (s === 'hvac_filter' || s === 'sprinkler') return s;
  return 'general';
}

export async function upsertAppliance(
  propertyId: string,
  applianceId: string | null,
  formData: FormData,
) {
  const supabase = createClient();

  const applianceType = parseType(formData.get('appliance_type'));
  const intervalMonths =
    applianceType === 'sprinkler'
      ? null
      : parseIntervalMonths(formData.get('service_interval_months'));
  const lastService =
    applianceType === 'sprinkler' ? null : nonEmpty(formData.get('last_service_date'));
  let nextServiceDue =
    applianceType === 'sprinkler' ? null : nonEmpty(formData.get('next_service_due'));

  // Auto-fill next service date when the user gave us an interval + last
  // service date but didn't supply next_service_due themselves.
  if (intervalMonths && lastService && !nextServiceDue) {
    nextServiceDue = format(
      addMonths(parseISO(lastService), intervalMonths),
      'yyyy-MM-dd',
    );
  }

  const applianceName = String(formData.get('name') ?? '').trim();

  const payload = {
    property_id: propertyId,
    name: applianceName,
    appliance_type: applianceType,
    install_date: nonEmpty(formData.get('install_date')),
    warranty_end: applianceType === 'general' ? nonEmpty(formData.get('warranty_end')) : null,
    serial: applianceType === 'general' ? nonEmpty(formData.get('serial')) : null,
    model: applianceType === 'general' ? nonEmpty(formData.get('model')) : null,
    dimensions:
      applianceType === 'hvac_filter' ? nonEmpty(formData.get('dimensions')) : null,
    last_service_date: lastService,
    next_service_due: nextServiceDue,
    service_interval_months: intervalMonths,
    spring_startup_date:
      applianceType === 'sprinkler'
        ? nonEmpty(formData.get('spring_startup_date'))
        : null,
    winterize_date:
      applianceType === 'sprinkler' ? nonEmpty(formData.get('winterize_date')) : null,
    notes: nonEmpty(formData.get('notes')),
  };

  if (!payload.name) throw new Error('Name is required');

  let finalApplianceId: string;

  if (applianceId) {
    const { error } = await supabase
      .from('appliances')
      .update(payload)
      .eq('id', applianceId);
    if (error) throw error;
    finalApplianceId = applianceId;
  } else {
    const { data: newAppl, error } = await supabase
      .from('appliances')
      .insert(payload)
      .select('id')
      .single();
    if (error) throw error;
    finalApplianceId = newAppl.id;
  }

  // When a next_service_due date is set, auto-create a maintenance_event for it
  // so the landlord can set customizable reminders from the Schedule tab.
  if (nextServiceDue) {
    // Check if there's already a non-completed maintenance event on that exact date
    const { data: existing } = await supabase
      .from('maintenance_events')
      .select('id')
      .eq('appliance_id', finalApplianceId)
      .eq('scheduled_date', nextServiceDue)
      .is('completed_at', null)
      .limit(1);

    if (!existing || existing.length === 0) {
      // Create the maintenance event
      const eventTitle = applianceName ? `${applianceName} service` : 'Service';
      const { data: newEvent, error: eventErr } = await supabase
        .from('maintenance_events')
        .insert({
          appliance_id: finalApplianceId,
          property_id: propertyId,
          title: eventTitle,
          scheduled_date: nextServiceDue,
        })
        .select('id')
        .single();

      if (!eventErr && newEvent) {
        // Add default reminder: 7 days before, landlord only
        await supabase.from('maintenance_reminders').insert({
          event_id: newEvent.id,
          days_before: 7,
          notify_landlord: true,
          notify_tenant: false,
        });

        // Remove old-style reminders for this appliance to prevent double-notification.
        // The maintenance_reminders system will handle notifications going forward.
        await supabase
          .from('reminders')
          .delete()
          .eq('appliance_id', finalApplianceId)
          .eq('dismissed', false);
      }
    }
  }

  revalidatePath(`/landlord/properties/${propertyId}`);
  revalidatePath(`/landlord/properties/${propertyId}/appliances/${finalApplianceId}`);

  // If a service date was set, land on the Schedule tab so reminders can be customized
  if (nextServiceDue) {
    redirect(`/landlord/properties/${propertyId}/appliances/${finalApplianceId}?tab=schedule`);
  } else {
    redirect(`/landlord/properties/${propertyId}`);
  }
}

export async function deleteAppliance(propertyId: string, applianceId: string) {
  const supabase = createClient();
  await supabase.from('appliances').delete().eq('id', applianceId);
  revalidatePath(`/landlord/properties/${propertyId}`);
  redirect(`/landlord/properties/${propertyId}`);
}

export async function markApplianceServiced(propertyId: string, applianceId: string) {
  const supabase = createClient();
  const { data: appl } = await supabase
    .from('appliances')
    .select('service_interval_months, name')
    .eq('id', applianceId)
    .maybeSingle();

  const today = format(new Date(), 'yyyy-MM-dd');
  const updates: { last_service_date: string; next_service_due: string | null } = {
    last_service_date: today,
    next_service_due: null,
  };
  let newNextServiceDue: string | null = null;
  if (appl?.service_interval_months) {
    newNextServiceDue = format(
      addMonths(parseISO(today), appl.service_interval_months),
      'yyyy-MM-dd',
    );
    updates.next_service_due = newNextServiceDue;
  }

  // Clear any open appliance reminders for this appliance — they'll be
  // regenerated by the next cron run if a new service is approaching.
  await supabase
    .from('reminders')
    .delete()
    .eq('appliance_id', applianceId)
    .eq('dismissed', false);

  const { error } = await supabase
    .from('appliances')
    .update(updates)
    .eq('id', applianceId);
  if (error) throw error;

  // Auto-create a maintenance_event for the new next_service_due if set
  if (newNextServiceDue) {
    const { data: existing } = await supabase
      .from('maintenance_events')
      .select('id')
      .eq('appliance_id', applianceId)
      .eq('scheduled_date', newNextServiceDue)
      .is('completed_at', null)
      .limit(1);

    if (!existing || existing.length === 0) {
      const applianceName = appl?.name ?? '';
      const eventTitle = applianceName ? `${applianceName} service` : 'Service';
      const { data: newEvent, error: eventErr } = await supabase
        .from('maintenance_events')
        .insert({
          appliance_id: applianceId,
          property_id: propertyId,
          title: eventTitle,
          scheduled_date: newNextServiceDue,
        })
        .select('id')
        .single();

      if (!eventErr && newEvent) {
        await supabase.from('maintenance_reminders').insert({
          event_id: newEvent.id,
          days_before: 7,
          notify_landlord: true,
          notify_tenant: false,
        });
      }
    }
  }

  revalidatePath(`/landlord/properties/${propertyId}`);
  revalidatePath(`/landlord/properties/${propertyId}/appliances/${applianceId}`);
  revalidatePath('/landlord/reminders');
}
